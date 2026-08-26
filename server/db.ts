import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  annualGoals,
  calendarEvents,
  deliverables,
  InsertUser,
  projectMembers,
  projects,
  taskParticipants,
  tasks,
  teamMembers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

type WorkTask = { assigneeMemberId: number | null; status: string; priority: string };

export function calculateWorkload(tasks: WorkTask[], memberId: number) {
  const active = tasks.filter((task) => task.assigneeMemberId === memberId && task.status !== "complete");
  const load = active.reduce((sum, task) => sum + (task.priority === "urgent" ? 4 : task.priority === "high" ? 3 : task.priority === "medium" ? 2 : 1), 0);
  return { activeTaskCount: active.length, overdueCount: active.filter((task) => task.status === "overdue").length, load, loadStatus: load >= 9 ? "loaded" : load >= 5 ? "busy" : "available" } as const;
}

export function shouldWarnAssignee(activeTaskCount: number) {
  return activeTaskCount >= 4;
}

export function summarizeTasks(tasks: Pick<WorkTask, "status">[]) {
  const completed = tasks.filter((task) => task.status === "complete").length;
  const overdue = tasks.filter((task) => task.status === "overdue").length;
  return { achievement: tasks.length ? Math.round((completed / tasks.length) * 100) : 0, overdue, completed, taskCount: tasks.length };
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const d = (value: string) => new Date(`${value}T09:00:00.000Z`);

async function ensureDemoData() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: teamMembers.id }).from(teamMembers).limit(1);
  if (existing.length) return;

  await db.insert(teamMembers).values([
    { name: "سارة الحربي", role: "مديرة القسم", avatarInitials: "سح", color: "#52769F" },
    { name: "عمر العتيبي", role: "قائد المشاريع", avatarInitials: "عع", color: "#6C8FB8" },
    { name: "نورة السالم", role: "أخصائية المحتوى", avatarInitials: "نس", color: "#839EBE" },
    { name: "فيصل القحطاني", role: "محلل أعمال", avatarInitials: "فق", color: "#94AABD" },
    { name: "ريم الدوسري", role: "مصممة تجربة", avatarInitials: "رد", color: "#7899B7" },
    { name: "خالد الغامدي", role: "منسق عمليات", avatarInitials: "خغ", color: "#A2B3C3" },
  ]);
  const members = await db.select().from(teamMembers);
  const byName = (name: string) => members.find((m) => m.name === name)!.id;

  await db.insert(annualGoals).values([
    { title: "رفع جودة المحتوى", theme: "تجربة المستفيد", year: 2026, ownerMemberId: byName("نورة السالم"), progress: 70, status: "on_track" },
    { title: "تطوير الحلول الرقمية", theme: "التحول الرقمي", year: 2026, ownerMemberId: byName("عمر العتيبي"), progress: 60, status: "attention" },
    { title: "بناء القدرات", theme: "تمكين الفريق", year: 2026, ownerMemberId: byName("سارة الحربي"), progress: 80, status: "on_track" },
    { title: "تعزيز الشراكات", theme: "الأثر المؤسسي", year: 2026, ownerMemberId: byName("خالد الغامدي"), progress: 55, status: "at_risk" },
  ]);
  const goals = await db.select().from(annualGoals);
  const goal = (title: string) => goals.find((item) => item.title === title)!.id;

  await db.insert(projects).values([
    { title: "بوابة الخدمات الرقمية", summary: "تطوير تجربة موحدة للخدمات ذات الأولوية.", annualGoalId: goal("تطوير الحلول الرقمية"), ownerMemberId: byName("عمر العتيبي"), startDate: d("2026-07-01"), endDate: d("2026-09-30"), progress: 61, status: "in_progress" },
    { title: "دليل المحتوى المؤسسي", summary: "دليل موحد لأسلوب المحتوى والنشر.", annualGoalId: goal("رفع جودة المحتوى"), ownerMemberId: byName("نورة السالم"), startDate: d("2026-07-15"), endDate: d("2026-09-15"), progress: 72, status: "in_review" },
    { title: "برنامج بناء القدرات", summary: "مسار تعلم داخلي للفريق.", annualGoalId: goal("بناء القدرات"), ownerMemberId: byName("سارة الحربي"), startDate: d("2026-06-01"), endDate: d("2026-11-30"), progress: 76, status: "in_progress" },
    { title: "منصة الشراكات", summary: "نموذج موحد لفرص وتقييم الشراكات.", annualGoalId: goal("تعزيز الشراكات"), ownerMemberId: byName("خالد الغامدي"), startDate: d("2026-08-01"), endDate: d("2026-10-31"), progress: 38, status: "blocked" },
    { title: "تحسين رحلة المستفيد", summary: "بحث وتحسين نقاط الاتصال الرئيسية.", annualGoalId: goal("رفع جودة المحتوى"), ownerMemberId: byName("ريم الدوسري"), startDate: d("2026-07-01"), endDate: d("2026-10-15"), progress: 52, status: "in_progress" },
    { title: "تقرير الأداء الربع سنوي", summary: "تجهيز تقرير موحد للإدارة.", annualGoalId: goal("تطوير الحلول الرقمية"), ownerMemberId: byName("فيصل القحطاني"), startDate: d("2026-08-01"), endDate: d("2026-09-20"), progress: 44, status: "in_progress" },
  ]);
  const allProjects = await db.select().from(projects);
  const project = (title: string) => allProjects.find((item) => item.title === title)!.id;

  await db.insert(projectMembers).values(allProjects.flatMap((item) => members.slice(0, 3).map((member) => ({ projectId: item.id, memberId: member.id }))));
  await db.insert(deliverables).values([
    { projectId: project("بوابة الخدمات الرقمية"), title: "النموذج الأولي", dueDate: d("2026-08-21"), progress: 100, status: "complete" },
    { projectId: project("بوابة الخدمات الرقمية"), title: "دليل الاستخدام", dueDate: d("2026-09-10"), progress: 65, status: "in_progress" },
    { projectId: project("بوابة الخدمات الرقمية"), title: "التقرير النهائي", dueDate: d("2026-09-30"), progress: 0, status: "not_started" },
    { projectId: project("دليل المحتوى المؤسسي"), title: "مسودة الدليل", dueDate: d("2026-08-28"), progress: 100, status: "complete" },
    { projectId: project("تقرير الأداء الربع سنوي"), title: "لوحة المؤشرات", dueDate: d("2026-09-20"), progress: 45, status: "in_progress" },
  ]);
  const outputs = await db.select().from(deliverables);
  const output = (title: string) => outputs.find((item) => item.title === title)!.id;

  await db.insert(tasks).values([
    { title: "اعتماد تقرير المشروع", projectId: project("تقرير الأداء الربع سنوي"), assigneeMemberId: byName("سارة الحربي"), startDate: d("2026-08-20"), dueDate: d("2026-08-24"), priority: "urgent", status: "overdue", isApprovalPending: true },
    { title: "تحديث واجهات النموذج الأولي", projectId: project("بوابة الخدمات الرقمية"), deliverableId: output("النموذج الأولي"), assigneeMemberId: byName("ريم الدوسري"), startDate: d("2026-08-24"), dueDate: d("2026-08-27"), priority: "high", status: "in_progress" },
    { title: "مراجعة دليل الاستخدام", projectId: project("بوابة الخدمات الرقمية"), deliverableId: output("دليل الاستخدام"), assigneeMemberId: byName("نورة السالم"), startDate: d("2026-08-23"), dueDate: d("2026-08-28"), priority: "high", status: "in_review" },
    { title: "تنسيق ورشة الفريق", projectId: project("برنامج بناء القدرات"), assigneeMemberId: byName("خالد الغامدي"), startDate: d("2026-08-25"), dueDate: d("2026-08-26"), priority: "medium", status: "in_progress" },
    { title: "تحليل ملاحظات المستفيدين", projectId: project("تحسين رحلة المستفيد"), assigneeMemberId: byName("فيصل القحطاني"), startDate: d("2026-08-24"), dueDate: d("2026-08-29"), priority: "medium", status: "in_progress" },
    { title: "إعداد نموذج تقييم الشراكات", projectId: project("منصة الشراكات"), assigneeMemberId: byName("خالد الغامدي"), startDate: d("2026-08-18"), dueDate: d("2026-08-30"), priority: "high", status: "not_started" },
    { title: "صياغة مقدمة الدليل", projectId: project("دليل المحتوى المؤسسي"), deliverableId: output("مسودة الدليل"), assigneeMemberId: byName("نورة السالم"), startDate: d("2026-08-20"), dueDate: d("2026-08-25"), priority: "medium", status: "complete" },
    { title: "توثيق مؤشرات الأداء", projectId: project("تقرير الأداء الربع سنوي"), deliverableId: output("لوحة المؤشرات"), assigneeMemberId: byName("فيصل القحطاني"), startDate: d("2026-08-21"), dueDate: d("2026-08-31"), priority: "high", status: "in_progress" },
    { title: "اختبار رحلة التسجيل", projectId: project("بوابة الخدمات الرقمية"), assigneeMemberId: byName("عمر العتيبي"), startDate: d("2026-08-25"), dueDate: d("2026-08-28"), priority: "medium", status: "not_started" },
    { title: "تجهيز تقرير الورشة", projectId: project("برنامج بناء القدرات"), assigneeMemberId: byName("سارة الحربي"), startDate: d("2026-08-26"), dueDate: d("2026-09-02"), priority: "low", status: "not_started" },
    { title: "بحث مقارنة السوق", projectId: project("منصة الشراكات"), assigneeMemberId: byName("خالد الغامدي"), startDate: d("2026-08-19"), dueDate: d("2026-08-26"), priority: "high", status: "overdue" },
    { title: "عرض نتائج المقابلات", projectId: project("تحسين رحلة المستفيد"), assigneeMemberId: byName("ريم الدوسري"), startDate: d("2026-08-23"), dueDate: d("2026-08-27"), priority: "medium", status: "in_review" },
    { title: "توحيد مسميات الخدمات", projectId: project("بوابة الخدمات الرقمية"), assigneeMemberId: byName("نورة السالم"), startDate: d("2026-08-24"), dueDate: d("2026-08-28"), priority: "low", status: "not_started" },
    { title: "مراجعة خارطة القدرات", projectId: project("برنامج بناء القدرات"), assigneeMemberId: byName("سارة الحربي"), startDate: d("2026-08-22"), dueDate: d("2026-08-29"), priority: "high", status: "complete" },
    { title: "إعداد البيانات المصدرية", projectId: project("تقرير الأداء الربع سنوي"), assigneeMemberId: byName("فيصل القحطاني"), startDate: d("2026-08-20"), dueDate: d("2026-08-27"), priority: "high", status: "complete" },
    { title: "تنسيق اجتماع الإطلاق", projectId: project("بوابة الخدمات الرقمية"), assigneeMemberId: byName("خالد الغامدي"), startDate: d("2026-08-25"), dueDate: d("2026-08-26"), priority: "medium", status: "not_started" },
    { title: "جمع الاحتياجات", projectId: project("تحسين رحلة المستفيد"), assigneeMemberId: byName("ريم الدوسري"), startDate: d("2026-08-18"), dueDate: d("2026-08-24"), priority: "low", status: "complete" },
    { title: "تدقيق بيانات التقرير", projectId: project("تقرير الأداء الربع سنوي"), assigneeMemberId: byName("عمر العتيبي"), startDate: d("2026-08-23"), dueDate: d("2026-08-28"), priority: "medium", status: "in_progress" },
  ]);
  const seededTasks = await db.select().from(tasks);
  await db.insert(taskParticipants).values(seededTasks.slice(0, 8).map((item) => ({ taskId: item.id, memberId: byName("عمر العتيبي") })));
  await db.insert(calendarEvents).values([
    { title: "اجتماع متابعة القسم", eventDate: d("2026-08-26"), type: "meeting" },
    { title: "تسليم دليل المحتوى", projectId: project("دليل المحتوى المؤسسي"), eventDate: d("2026-08-28"), type: "delivery" },
    { title: "ورشة بناء القدرات", projectId: project("برنامج بناء القدرات"), eventDate: d("2026-09-03"), type: "workshop" },
    { title: "إطلاق النسخة التجريبية", projectId: project("بوابة الخدمات الرقمية"), eventDate: d("2026-09-10"), type: "launch" },
    { title: "تسليم تقرير الأداء", projectId: project("تقرير الأداء الربع سنوي"), eventDate: d("2026-09-20"), type: "delivery" },
  ]);
}

export async function getWorkspaceData() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await ensureDemoData();
  const [goals, members, projectRows, deliverableRows, taskRows, eventRows] = await Promise.all([
    db.select().from(annualGoals), db.select().from(teamMembers), db.select().from(projects),
    db.select().from(deliverables), db.select().from(tasks), db.select().from(calendarEvents),
  ]);
  const enrichedMembers = members.map((member) => {
    return { ...member, ...calculateWorkload(taskRows, member.id) };
  });
  return { goals, members: enrichedMembers, projects: projectRows, deliverables: deliverableRows, tasks: taskRows, events: eventRows };
}

export async function getTeamWorkload() {
  const workspace = await getWorkspaceData();
  return workspace.members;
}

export async function getReportSummary() {
  const workspace = await getWorkspaceData();
  return summarizeTasks(workspace.tasks);
}

export async function addTaskComment(input: { taskId: number; authorMemberId: number; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const { taskComments } = await import("../drizzle/schema");
  await db.insert(taskComments).values(input);
}

export async function createProject(input: { title: string; summary?: string; annualGoalId?: number | null; ownerMemberId: number; startDate: Date; endDate: Date; status: "planned" | "in_progress" | "in_review" | "complete" | "blocked"; }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await db.insert(projects).values({ ...input, summary: input.summary ?? null, annualGoalId: input.annualGoalId ?? null, progress: 0 });
}

export async function createTask(input: { title: string; projectId?: number | null; assigneeMemberId?: number | null; startDate?: Date | null; dueDate?: Date | null; priority: "urgent" | "high" | "medium" | "low"; status: "not_started" | "in_progress" | "in_review" | "complete" | "overdue"; parentTaskId?: number | null; }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const warningMember = input.assigneeMemberId ? await db.select().from(tasks).where(eq(tasks.assigneeMemberId, input.assigneeMemberId)) : [];
  await db.insert(tasks).values({ ...input, projectId: input.projectId ?? null, assigneeMemberId: input.assigneeMemberId ?? null, startDate: input.startDate ?? null, dueDate: input.dueDate ?? null, parentTaskId: input.parentTaskId ?? null });
  return { showLoadWarning: shouldWarnAssignee(warningMember.filter((task) => task.status !== "complete").length) };
}

export async function updateTaskStatus(id: number, status: "not_started" | "in_progress" | "in_review" | "complete" | "overdue") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await db.update(tasks).set({ status }).where(eq(tasks.id, id));
}

export async function updateProjectStatus(id: number, status: "planned" | "in_progress" | "in_review" | "complete" | "blocked") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await db.update(projects).set({ status }).where(eq(projects.id, id));
}
