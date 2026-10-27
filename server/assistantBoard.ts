import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as dbModule from "./db";
import * as personal from "./personal";
import * as business from "./business";
import type { BusinessRecord } from "../shared/business";
import * as commerce from "./commerce";
import * as ideas from "./ideaLab";
import {
  managementBoards,
  boardMemberships,
  personalLifeTasks,
  ideaLabTasks,
  tasks as workTasks,
} from "../drizzle/schema";
import { assistantAction, type AssistantAction } from "../shared/assistant";
import { commerceTaskFields, commerceStatusLabels } from "../shared/commerce";
import { personalTaskFields } from "../shared/personal";

export const taskRevision = (row: unknown) =>
  parseInt(
    createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 12),
    16
  ) || 1;
export const day = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Riyadh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date)
    : null;
export const taskDate = (value: string | null, existing?: Date | null) =>
  value === day(existing ?? null)
    ? (existing ?? null)
    : value
      ? new Date(value + "T09:00:00Z")
      : null;
const ideaStatuses = {
  todo: "لم تبدأ",
  in_progress: "جاري العمل",
  blocked: "بانتظار",
  done: "مكتملة",
};
const priorities = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "مرتفعة",
  urgent: "عاجلة",
};
function basic(fields: Partial<AssistantAction> & { title: string }) {
  return assistantAction.parse({
    taskId: null,
    version: null,
    sectionId: null,
    dueDate: null,
    assigneeUserId: null,
    ...fields,
  });
}
export function personalAction(row: typeof personalLifeTasks.$inferSelect) {
  return basic({
    taskId: row.id,
    version: row.version,
    title: row.title,
    sectionId: row.categoryId,
    dueDate: row.dueDate,
    executionDate: row.executionDate,
    executionTime: row.executionTime,
    focusDate: row.focusDate,
    status: row.done ? "done" : "todo",
    assigneeUserId: row.userId,
  });
}
export function ideaAction(row: typeof ideaLabTasks.$inferSelect) {
  return basic({
    taskId: row.id,
    version: taskRevision(row),
    title: row.title,
    sectionId: row.ideaId,
    description: row.description ?? "",
    status: row.status,
    priority: row.priority,
    assigneeUserId: row.assigneeUserId,
    dueDate: day(row.dueDate),
  });
}
export function workAction(row: typeof workTasks.$inferSelect) {
  const { assigneeMemberIds: _assignees, ...raw } = row as typeof row & {
    assigneeMemberIds?: number[];
  };
  return basic({
    taskId: row.id,
    version: taskRevision(raw),
    title: row.title,
    sectionId: row.projectId,
    description: row.description ?? "",
    status:
      row.status === "complete"
        ? "done"
        : row.status === "not_started"
          ? "todo"
          : row.status,
    priority: row.priority,
    assigneeUserId: row.assigneeMemberId,
    dueDate: day(row.dueDate),
  });
}
export function businessAction(row: BusinessRecord) {
  return basic({
    taskId: row.id,
    version: row.version,
    title: row.data.title,
    sectionId: row.data.projectId,
    description: row.data.notes,
    assigneeUserId: row.data.assigneeUserId,
    dueDate: row.data.dueDate,
    priority: row.data.priority,
    status:
      row.data.status === "مكتملة"
        ? "done"
        : row.data.status === "قيد التنفيذ"
          ? "in_progress"
          : "todo",
  });
}
export async function boardKind(boardId: number) {
  const db = (await dbModule.getDb())!;
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "قاعدة البيانات غير متاحة",
    });
  const [board] = await db
    .select()
    .from(managementBoards)
    .where(eq(managementBoards.id, boardId));
  if (!board)
    throw new TRPCError({ code: "NOT_FOUND", message: "اللوحة غير متاحة" });
  return { db, template: board.template, name: board.name };
}
export type AssistantBoardContext = {
  template: string;
  name: string;
  sectionLabel: string;
  nullableSection: boolean;
  personal: boolean;
  defaultAssigneeId: number | null;
  sections: { id: number; name: string; archived: boolean }[];
  members: { userId: number | null; name: string }[];
  tasks: AssistantAction[];
  statusLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  extra: unknown;
};
export async function boardContext(
  boardId: number,
  userId: number
): Promise<AssistantBoardContext> {
  const { db, template, name } = await boardKind(boardId);
  const memberships = await db
    .select()
    .from(boardMemberships)
    .where(eq(boardMemberships.boardId, boardId));
  if (!memberships.some(m => m.userId === userId))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "اللوحة غير متاحة لحسابك",
    });
  const eligible = memberships
    .filter(m => m.role !== "viewer")
    .map(m => m.userId);
  const common = {
    template,
    name,
    sectionLabel: "القسم",
    nullableSection: false,
    personal: false,
    defaultAssigneeId: eligible.includes(userId) ? userId : null,
    members: [] as { userId: number | null; name: string }[],
    sections: [] as { id: number; name: string; archived: boolean }[],
    tasks: [] as AssistantAction[],
    statusLabels: ideaStatuses as Record<string, string>,
    priorityLabels: priorities as Record<string, string>,
    extra: {} as unknown,
  };
  if (template === "business") {
    const data = await business.overview(boardId, userId);
    const rows = data.records.filter(r => !r.archived);
    return {
      ...common,
      nullableSection: true,
      sectionLabel: "المشروع",
      sections: rows
        .filter(r => r.kind === "project")
        .map(r => ({ id: r.id, name: r.data.title, archived: false })),
      members: data.members
        .filter(m => m.role !== "viewer")
        .map(m => ({ userId: m.userId, name: m.name ?? "عضو" })),
      tasks: rows.filter(r => r.kind === "task").map(businessAction),
      statusLabels: {
        todo: "قادمة",
        in_progress: "قيد التنفيذ",
        done: "مكتملة",
      },
      priorityLabels: { normal: "عادية", urgent: "عالية" },
      extra: {
        projects: rows
          .filter(r => r.kind === "project")
          .map(r => ({
            id: r.id,
            title: r.data.title,
            status: r.data.status,
            nextStep: r.data.nextStep,
          })),
        scope:
          "يدعم المساعد إضافة وتعديل المهام فقط. تُدار الأموال والوثائق والموردون من نماذج القالب.",
      },
    };
  }
  if (template === "commerce_import") {
    const data = await commerce.overview(boardId);
    return {
      ...common,
      sections: data.sections
        .filter(s => !s.archived)
        .map(s => ({ id: s.id, name: s.name, archived: false })),
      members: data.members
        .filter(m => m.userId && eligible.includes(m.userId))
        .map(m => ({ userId: m.userId, name: m.name })),
      tasks: data.tasks
        .filter(
          t =>
            !t.archived &&
            data.sections.some(s => s.id === t.sectionId && !s.archived)
        )
        .map(t =>
          basic({
            ...t,
            taskId: t.id,
            description: t.description ?? "",
            waitingReason: t.waitingReason ?? "",
            checklist: t.checklist ?? [],
          })
        ),
      statusLabels: commerceStatusLabels,
      priorityLabels: { normal: "عادية", urgent: "عاجلة" },
    };
  }
  if (template === "personal") {
    const data = await personal.overview(boardId, userId);
    return {
      ...common,
      personal: true,
      nullableSection: true,
      sectionLabel: "جانب الحياة",
      sections: data.categories.map(c => ({
        id: c.id,
        name: c.name,
        archived: false,
      })),
      tasks: data.tasks.map(personalAction),
      members: [{ userId, name: "أنا" }],
      statusLabels: { todo: "لم تنجز", done: "منجزة" },
      priorityLabels: { normal: "عادية" },
    };
  }
  if (template === "idea_lab") {
    const data = await ideas.getIdeaLabOverview(boardId);
    return {
      ...common,
      nullableSection: true,
      sectionLabel: "الفكرة المرتبطة",
      sections: data.ideas.map(i => ({
        id: i.id,
        name: i.title,
        archived: false,
      })),
      members: data.members
        .filter(m => m.userId && eligible.includes(m.userId))
        .map(m => ({ userId: m.userId, name: m.name })),
      tasks: data.tasks.map(ideaAction),
      extra: {
        ideas: data.ideas.slice(0, 30).map(i => ({
          id: i.id,
          title: i.title,
          description: i.description?.slice(0, 500),
          stage: i.stage,
        })),
        problems: data.problems
          .slice(0, 30)
          .map(p => ({ id: p.id, title: p.title, description: p.description })),
      },
    };
  }
  const data = await dbModule.getWorkspaceData(boardId, userId);
  return {
    ...common,
    nullableSection: true,
    sectionLabel: "المشروع",
    defaultAssigneeId: data.members.find(m => m.userId === userId)?.id ?? null,
    sections: data.projects.map(p => ({
      id: p.id,
      name: p.title,
      archived: false,
    })),
    members: data.members.map(m => ({ userId: m.id, name: m.name })),
    tasks: data.tasks.map(workAction),
    statusLabels: {
      ...ideaStatuses,
      in_review: "قيد المراجعة",
      overdue: "متأخرة",
    },
  };
}
export function validateBoardActions(
  actions: AssistantAction[],
  data: AssistantBoardContext
) {
  const ids = new Set<number>();
  for (const a of actions) {
    if (
      (a.sectionId === null && !data.nullableSection) ||
      (a.sectionId !== null && !data.sections.some(s => s.id === a.sectionId))
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "اختر قسمًا متاحًا في اللوحة الحالية",
      });
    if (
      a.assigneeUserId !== null &&
      !data.members.some(m => m.userId === a.assigneeUserId)
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "المسؤول غير متاح في هذه اللوحة",
      });
    if (
      !(a.status in data.statusLabels) ||
      !(a.priority in data.priorityLabels)
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "الحالة أو الأولوية غير متاحة في هذا القالب",
      });
    if (data.personal) {
      personalTaskFields.parse({
        title: a.title,
        categoryId: a.sectionId,
        dueDate: a.dueDate,
        executionDate: a.executionDate,
        executionTime: a.executionTime,
      });
      if (
        a.assigneeUserId !== data.members[0]?.userId ||
        a.description ||
        a.checklist.length ||
        a.waitingReason
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "المهمة الشخصية تخصك وتستخدم حقول القالب الشخصية فقط",
        });
    } else if (
      a.executionDate ||
      a.executionTime ||
      a.focusDate ||
      (data.template !== "commerce_import" &&
        (a.checklist.length || a.waitingReason))
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "الاقتراح يحتوي حقولًا لا يدعمها القالب",
      });
    if (data.template === "commerce_import") commerceTaskFields.parse(a);
    if (
      !data.personal &&
      data.template !== "commerce_import" &&
      data.template !== "idea_lab" &&
      a.title.length > 240
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "عنوان المهمة أطول من الحد المسموح",
      });
    if (a.taskId !== null) {
      const current = data.tasks.find(t => t.taskId === a.taskId);
      if (!current)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "المهمة غير متاحة في هذه اللوحة",
        });
      if (ids.has(a.taskId))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "تكرر تعديل المهمة في الاقتراح",
        });
      ids.add(a.taskId);
      if (a.version !== current.version)
        throw new TRPCError({
          code: "CONFLICT",
          message: "تغيرت المهمة، اطلب اقتراحًا جديدًا",
        });
    } else if (a.version !== null)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "هوية المهمة الجديدة غير صالحة",
      });
  }
}
