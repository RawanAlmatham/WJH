import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb, calculateProjectProgress } from "./db";
import {
  boardContext,
  validateBoardActions,
  personalAction,
  businessAction,
  ideaAction,
  workAction,
  taskDate,
} from "./assistantBoard";
import {
  businessRecords,
  assistantDrafts,
  boardMemberships,
  managementBoards,
  personalLifeCategories,
  personalLifeTasks,
  ideaLabIdeas,
  ideaLabTasks,
  tasks as workTasks,
  teamMembers,
  projects,
  taskAssignees,
  deliverables,
  users,
} from "../drizzle/schema";
import { businessData, businessSave } from "../shared/business";
import { saveBusinessRecord } from "./business";
import type { AssistantAction } from "../shared/assistant";

export async function applyOtherDraft(
  boardId: number,
  userId: number,
  draftId: string,
  actions: AssistantAction[]
) {
  const db = (await getDb())!;
  const context = await boardContext(boardId, userId);
  return db.transaction(async tx => {
    const [draft] = await tx
      .select()
      .from(assistantDrafts)
      .where(
        and(
          eq(assistantDrafts.id, draftId),
          eq(assistantDrafts.boardId, boardId),
          eq(assistantDrafts.userId, userId)
        )
      )
      .for("update");
    if (!draft)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "الاقتراح غير متاح للوحة أو الحساب",
      });
    if (draft.appliedAt) return { applied: true, alreadyApplied: true };
    if (draft.expiresAt.getTime() < Date.now())
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "انتهت صلاحية الاقتراح",
      });
    if (
      actions.length !== draft.actions.length ||
      actions.some(
        (a, i) =>
          a.taskId !== draft.actions[i].taskId ||
          a.version !== draft.actions[i].version
      )
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "تغيرت هوية الاقتراح",
      });
    const [board] = await tx
      .select()
      .from(managementBoards)
      .where(eq(managementBoards.id, boardId))
      .for("update");
    if (board.template !== context.template)
      throw new TRPCError({ code: "CONFLICT", message: "تغير قالب اللوحة" });
    const memberships = await tx
      .select()
      .from(boardMemberships)
      .where(eq(boardMemberships.boardId, boardId))
      .for("update");
    const membership = memberships.find(m => m.userId === userId);
    if (!membership || membership.role === "viewer")
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ليس لديك صلاحية تعديل اللوحة",
      });
    if (context.template === "business") {
      const rows = await tx
        .select()
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.boardId, boardId),
            eq(businessRecords.archived, false)
          )
        )
        .for("update");
      validateBoardActions(actions, {
        ...context,
        sections: rows
          .filter(r => r.kind === "project")
          .map(r => ({ id: r.id, name: r.data.title, archived: false })),
        tasks: rows.filter(r => r.kind === "task").map(businessAction),
        members: context.members.filter(m =>
          memberships.some(b => b.userId === m.userId && b.role !== "viewer")
        ),
      });
      for (const a of actions) {
        const current = rows.find(r => r.id === a.taskId);
        const data = businessData.parse({
          ...current?.data,
          title: a.title,
          projectId: a.sectionId,
          notes: a.description,
          assigneeUserId: a.assigneeUserId,
          dueDate: a.dueDate,
          priority: a.priority,
          status:
            a.status === "done"
              ? "مكتملة"
              : a.status === "in_progress"
                ? "قيد التنفيذ"
                : "قادمة",
        });
        const input = businessSave.parse({
          boardId,
          kind: "task",
          id: a.taskId ?? undefined,
          version: a.version ?? undefined,
          data,
        });
        await saveBusinessRecord(tx, boardId, input);
      }
    } else if (context.personal) {
      const categories = await tx
        .select()
        .from(personalLifeCategories)
        .where(
          and(
            eq(personalLifeCategories.boardId, boardId),
            eq(personalLifeCategories.userId, userId)
          )
        )
        .for("update");
      const rows = await tx
        .select()
        .from(personalLifeTasks)
        .where(
          and(
            eq(personalLifeTasks.boardId, boardId),
            eq(personalLifeTasks.userId, userId)
          )
        )
        .for("update");
      validateBoardActions(actions, {
        ...context,
        sections: categories.map(c => ({ ...c, archived: false })),
        tasks: rows.map(personalAction),
      });
      for (const a of actions) {
        const fields = {
          title: a.title,
          categoryId: a.sectionId,
          dueDate: a.dueDate,
          executionDate: a.executionDate,
          executionTime: a.executionTime,
          focusDate: a.focusDate,
          done: a.status === "done",
        };
        if (a.taskId === null)
          await tx
            .insert(personalLifeTasks)
            .values({ ...fields, boardId, userId });
        else
          await tx
            .update(personalLifeTasks)
            .set({ ...fields, version: a.version! + 1 })
            .where(
              and(
                eq(personalLifeTasks.id, a.taskId),
                eq(personalLifeTasks.boardId, boardId),
                eq(personalLifeTasks.userId, userId)
              )
            );
      }
    } else if (context.template === "idea_lab") {
      const ideas = await tx
        .select()
        .from(ideaLabIdeas)
        .where(eq(ideaLabIdeas.boardId, boardId))
        .for("update");
      const rows = await tx
        .select()
        .from(ideaLabTasks)
        .where(eq(ideaLabTasks.boardId, boardId))
        .for("update");
      const members = await tx
        .select()
        .from(teamMembers)
        .where(
          and(eq(teamMembers.boardId, boardId), eq(teamMembers.isActive, true))
        )
        .for("update");
      validateBoardActions(actions, {
        ...context,
        sections: ideas.map(i => ({
          id: i.id,
          name: i.title,
          archived: false,
        })),
        tasks: rows.map(ideaAction),
        members: members
          .filter(m =>
            memberships.some(b => b.userId === m.userId && b.role !== "viewer")
          )
          .map(m => ({ userId: m.userId, name: m.name })),
      });
      for (const a of actions) {
        const current = rows.find(t => t.id === a.taskId);
        if (
          current &&
          a.sectionId !== current.ideaId &&
          (current.problemId || current.interviewId || current.experimentId)
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "المهمة مرتبطة بمشكلة أو مقابلة أو تجربة؛ عدّل ارتباطاتها من شاشة المهمة",
          });
        const fields = {
          title: a.title,
          ideaId: a.sectionId,
          description: a.description,
          status: a.status as "todo" | "in_progress" | "blocked" | "done",
          priority: a.priority as "low" | "medium" | "high" | "urgent",
          assigneeUserId: a.assigneeUserId,
          dueDate: taskDate(a.dueDate, current?.dueDate),
          completedAt:
            a.status === "done" ? (current?.completedAt ?? new Date()) : null,
        };
        if (a.taskId === null)
          await tx
            .insert(ideaLabTasks)
            .values({ ...fields, boardId, createdByUserId: userId });
        else
          await tx
            .update(ideaLabTasks)
            .set(fields)
            .where(
              and(
                eq(ideaLabTasks.id, a.taskId),
                eq(ideaLabTasks.boardId, boardId)
              )
            );
      }
    } else {
      const members = await tx
        .select()
        .from(teamMembers)
        .where(
          and(eq(teamMembers.boardId, boardId), eq(teamMembers.isActive, true))
        )
        .for("update");
      const mine = members.find(m => m.userId === userId);
      // Revalidate project access under the same locks used for saving.
      const [account] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId));
      const restricted =
        account?.role !== "admin" &&
        membership.role === "member" &&
        mine?.projectAccess === "selected";
      const allowed = (id: number | null) =>
        !id || !restricted || (mine?.allowedProjectIds ?? []).includes(id);
      const projectRows = await tx
        .select()
        .from(projects)
        .where(eq(projects.boardId, boardId))
        .for("update");
      const rows = await tx
        .select()
        .from(workTasks)
        .where(eq(workTasks.boardId, boardId))
        .for("update");
      validateBoardActions(actions, {
        ...context,
        sections: projectRows
          .filter(p => allowed(p.id))
          .map(p => ({ id: p.id, name: p.title, archived: false })),
        tasks: rows.filter(t => allowed(t.projectId)).map(workAction),
        members: members.map(m => ({ userId: m.id, name: m.name })),
      });
      const changedProjects = new Set<number>();
      for (const a of actions) {
        const current = rows.find(t => t.id === a.taskId);
        const fields = {
          title: a.title,
          description: a.description,
          projectId: a.sectionId,
          assigneeMemberId: a.assigneeUserId,
          dueDate: taskDate(a.dueDate, current?.dueDate),
          priority: a.priority as "low" | "medium" | "high" | "urgent",
          status: (a.status === "todo"
            ? "not_started"
            : a.status === "done"
              ? "complete"
              : a.status) as typeof workTasks.$inferSelect.status,
        };
        if (
          current &&
          current.projectId !== a.sectionId &&
          (current.deliverableId ||
            current.parentTaskId ||
            rows.some(t => t.parentTaskId === current.id))
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "المهمة مرتبطة بمخرج أو مهمة رئيسية، عدّل مشروعها من شاشة المهمة",
          });
        let id = a.taskId;
        if (id === null)
          id = Number(
            (await tx.insert(workTasks).values({ ...fields, boardId }))[0]
              .insertId
          );
        else
          await tx
            .update(workTasks)
            .set(fields)
            .where(and(eq(workTasks.id, id), eq(workTasks.boardId, boardId)));
        if (!current || current.assigneeMemberId !== a.assigneeUserId) {
          await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, id));
          if (a.assigneeUserId)
            await tx
              .insert(taskAssignees)
              .values({ taskId: id, memberId: a.assigneeUserId });
        }
        if (current?.projectId) changedProjects.add(current.projectId);
        if (a.sectionId) changedProjects.add(a.sectionId);
      }
      for (const projectId of Array.from(changedProjects)) {
        const ts = await tx
          .select({ status: workTasks.status })
          .from(workTasks)
          .where(eq(workTasks.projectId, projectId));
        const ds = await tx
          .select({ status: deliverables.status })
          .from(deliverables)
          .where(eq(deliverables.projectId, projectId));
        await tx
          .update(projects)
          .set({
            progress: calculateProjectProgress(ts, ds),
            isManualProgress: false,
          })
          .where(eq(projects.id, projectId));
      }
    }
    await tx
      .update(assistantDrafts)
      .set({ appliedAt: new Date(), actions: [] })
      .where(eq(assistantDrafts.id, draftId));
    return { applied: true, alreadyApplied: false };
  });
}
