import { and, desc, eq } from "drizzle-orm";
import {
  ideaLabExperiments,
  ideaLabIdeas,
  ideaLabInterviews,
  ideaLabProblems,
  ideaLabSources,
  ideaLabTasks,
  managementBoards,
  teamMembers,
  userAiSettings,
} from "../drizzle/schema";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  return db;
}

export async function getIdeaLabOverview(boardId: number) {
  const db = await database();
  const [
    board,
    problems,
    ideas,
    sources,
    interviews,
    experiments,
    tasks,
    members,
  ] = await Promise.all([
    db
      .select()
      .from(managementBoards)
      .where(eq(managementBoards.id, boardId))
      .limit(1),
    db
      .select()
      .from(ideaLabProblems)
      .where(eq(ideaLabProblems.boardId, boardId))
      .orderBy(desc(ideaLabProblems.updatedAt)),
    db
      .select()
      .from(ideaLabIdeas)
      .where(eq(ideaLabIdeas.boardId, boardId))
      .orderBy(desc(ideaLabIdeas.updatedAt)),
    db
      .select()
      .from(ideaLabSources)
      .where(eq(ideaLabSources.boardId, boardId))
      .orderBy(desc(ideaLabSources.createdAt)),
    db
      .select()
      .from(ideaLabInterviews)
      .where(eq(ideaLabInterviews.boardId, boardId))
      .orderBy(desc(ideaLabInterviews.interviewDate)),
    db
      .select()
      .from(ideaLabExperiments)
      .where(eq(ideaLabExperiments.boardId, boardId))
      .orderBy(desc(ideaLabExperiments.updatedAt)),
    db
      .select()
      .from(ideaLabTasks)
      .where(eq(ideaLabTasks.boardId, boardId))
      .orderBy(desc(ideaLabTasks.updatedAt)),
    db
      .select()
      .from(teamMembers)
      .where(
        and(eq(teamMembers.boardId, boardId), eq(teamMembers.isActive, true))
      )
      .orderBy(teamMembers.name),
  ]);
  if (!board[0]) throw new Error("لم نعثر على اللوحة الحالية");
  if (board[0].template !== "idea_lab")
    throw new Error("هذه اللوحة ليست من نوع مختبر الأفكار");
  return {
    board: board[0],
    problems,
    ideas,
    sources,
    interviews,
    experiments,
    tasks,
    members,
  };
}

export async function createIdeaLabProblem(input: {
  boardId: number;
  userId: number;
  title: string;
  description?: string | null;
  category?: string | null;
  audience?: string | null;
  ownerUserId?: number | null;
}) {
  const db = await database();
  const result = await db.insert(ideaLabProblems).values({
    boardId: input.boardId,
    title: input.title,
    description: input.description || null,
    category: input.category || null,
    audience: input.audience || null,
    ownerUserId: input.ownerUserId ?? input.userId,
    createdByUserId: input.userId,
  });
  return { id: Number(result[0].insertId) };
}

export async function createIdeaLabIdea(input: {
  boardId: number;
  userId: number;
  problemId?: number | null;
  title: string;
  description?: string | null;
  category?: string | null;
  audience?: string | null;
  ownerUserId?: number | null;
}) {
  const db = await database();
  if (input.problemId) await requireProblem(db, input.boardId, input.problemId);
  const result = await db.insert(ideaLabIdeas).values({
    boardId: input.boardId,
    problemId: input.problemId || null,
    title: input.title,
    description: input.description || null,
    category: input.category || null,
    audience: input.audience || null,
    ownerUserId: input.ownerUserId ?? input.userId,
    createdByUserId: input.userId,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateIdeaLabProblem(input: {
  boardId: number;
  id: number;
  title?: string;
  description?: string | null;
  category?: string | null;
  audience?: string | null;
  ownerUserId?: number | null;
  stage?: "raw" | "understanding" | "validated";
  evidenceStrength?: "none" | "low" | "medium" | "high";
}) {
  const db = await database();
  await requireProblem(db, input.boardId, input.id);
  const values: Partial<typeof ideaLabProblems.$inferInsert> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.description !== undefined) values.description = input.description;
  if (input.category !== undefined) values.category = input.category;
  if (input.audience !== undefined) values.audience = input.audience;
  if (input.ownerUserId !== undefined) values.ownerUserId = input.ownerUserId;
  if (input.stage) values.stage = input.stage;
  if (input.evidenceStrength) values.evidenceStrength = input.evidenceStrength;
  if (!Object.keys(values).length) return { id: input.id };
  await db
    .update(ideaLabProblems)
    .set(values)
    .where(
      and(
        eq(ideaLabProblems.id, input.id),
        eq(ideaLabProblems.boardId, input.boardId)
      )
    );
  return { id: input.id };
}

export async function updateIdeaLabIdea(input: {
  boardId: number;
  id: number;
  problemId?: number | null;
  title?: string;
  description?: string | null;
  category?: string | null;
  audience?: string | null;
  ownerUserId?: number | null;
  stage?:
    | "seed"
    | "exploration"
    | "interviews"
    | "experiment"
    | "promising"
    | "archived";
  confidence?: "low" | "medium" | "high";
}) {
  const db = await database();
  await requireIdea(db, input.boardId, input.id);
  if (input.problemId) await requireProblem(db, input.boardId, input.problemId);
  const values: Partial<typeof ideaLabIdeas.$inferInsert> = {};
  if (input.problemId !== undefined) values.problemId = input.problemId;
  if (input.title !== undefined) values.title = input.title;
  if (input.description !== undefined) values.description = input.description;
  if (input.category !== undefined) values.category = input.category;
  if (input.audience !== undefined) values.audience = input.audience;
  if (input.ownerUserId !== undefined) values.ownerUserId = input.ownerUserId;
  if (input.stage) values.stage = input.stage;
  if (input.confidence) values.confidence = input.confidence;
  if (!Object.keys(values).length) return { id: input.id };
  await db
    .update(ideaLabIdeas)
    .set(values)
    .where(
      and(
        eq(ideaLabIdeas.id, input.id),
        eq(ideaLabIdeas.boardId, input.boardId)
      )
    );
  return { id: input.id };
}

export async function createIdeaLabSource(input: {
  boardId: number;
  userId: number;
  problemId?: number | null;
  ideaId?: number | null;
  url: string;
  sourceType: string;
  title?: string | null;
  publisher?: string | null;
  notes?: string | null;
}) {
  const db = await database();
  if (!input.problemId && !input.ideaId)
    throw new Error("اربط المصدر بمشكلة أو فكرة");
  if (input.problemId) await requireProblem(db, input.boardId, input.problemId);
  if (input.ideaId) await requireIdea(db, input.boardId, input.ideaId);
  const result = await db.insert(ideaLabSources).values({
    boardId: input.boardId,
    problemId: input.problemId || null,
    ideaId: input.ideaId || null,
    url: input.url,
    sourceType: input.sourceType,
    title: input.title || null,
    publisher: input.publisher || null,
    notes: input.notes || null,
    createdByUserId: input.userId,
  });
  return { id: Number(result[0].insertId) };
}

export async function createIdeaLabInterview(input: {
  boardId: number;
  userId: number;
  problemId?: number | null;
  ideaId?: number | null;
  participantLabel: string;
  interviewDate?: Date | null;
  transcript?: string | null;
  summary?: string | null;
  insights?: string | null;
  themes?: string[];
}) {
  const db = await database();
  if (input.problemId) await requireProblem(db, input.boardId, input.problemId);
  if (input.ideaId) await requireIdea(db, input.boardId, input.ideaId);
  const result = await db.insert(ideaLabInterviews).values({
    boardId: input.boardId,
    problemId: input.problemId || null,
    ideaId: input.ideaId || null,
    participantLabel: input.participantLabel,
    interviewDate: input.interviewDate || null,
    transcript: input.transcript || null,
    summary: input.summary || null,
    insights: input.insights || null,
    themes: input.themes ?? [],
    status: input.transcript ? "transcribed" : "planned",
    ownerUserId: input.userId,
    createdByUserId: input.userId,
  });
  return { id: Number(result[0].insertId) };
}

export async function createIdeaLabExperiment(input: {
  boardId: number;
  userId: number;
  ideaId: number;
  title: string;
  hypothesis: string;
  successMetric?: string | null;
  targetValue?: number | null;
}) {
  const db = await database();
  await requireIdea(db, input.boardId, input.ideaId);
  const result = await db.insert(ideaLabExperiments).values({
    boardId: input.boardId,
    ideaId: input.ideaId,
    title: input.title,
    hypothesis: input.hypothesis,
    successMetric: input.successMetric || null,
    targetValue: input.targetValue ?? null,
    ownerUserId: input.userId,
    createdByUserId: input.userId,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateIdeaLabInterview(input: {
  boardId: number;
  id: number;
  problemId?: number | null;
  ideaId?: number | null;
  participantLabel?: string;
  interviewDate?: Date | null;
  status?: "planned" | "completed" | "transcribed" | "analyzed";
  transcript?: string | null;
  summary?: string | null;
  insights?: string | null;
  themes?: string[];
}) {
  const db = await database();
  await requireInterview(db, input.boardId, input.id);
  if (input.problemId) await requireProblem(db, input.boardId, input.problemId);
  if (input.ideaId) await requireIdea(db, input.boardId, input.ideaId);
  const values: Partial<typeof ideaLabInterviews.$inferInsert> = {};
  if (input.problemId !== undefined) values.problemId = input.problemId;
  if (input.ideaId !== undefined) values.ideaId = input.ideaId;
  if (input.participantLabel !== undefined)
    values.participantLabel = input.participantLabel;
  if (input.interviewDate !== undefined)
    values.interviewDate = input.interviewDate;
  if (input.status !== undefined) values.status = input.status;
  if (input.transcript !== undefined) values.transcript = input.transcript;
  if (input.summary !== undefined) values.summary = input.summary;
  if (input.insights !== undefined) values.insights = input.insights;
  if (input.themes !== undefined) values.themes = input.themes;
  if (!Object.keys(values).length) return { id: input.id };
  await db
    .update(ideaLabInterviews)
    .set(values)
    .where(
      and(
        eq(ideaLabInterviews.id, input.id),
        eq(ideaLabInterviews.boardId, input.boardId)
      )
    );
  return { id: input.id };
}

export async function updateIdeaLabExperiment(input: {
  boardId: number;
  id: number;
  title?: string;
  hypothesis?: string;
  successMetric?: string | null;
  targetValue?: number | null;
  currentValue?: number;
  status?: "planned" | "running" | "review" | "complete";
  result?: string | null;
}) {
  const db = await database();
  await requireExperiment(db, input.boardId, input.id);
  const values: Partial<typeof ideaLabExperiments.$inferInsert> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.hypothesis !== undefined) values.hypothesis = input.hypothesis;
  if (input.successMetric !== undefined)
    values.successMetric = input.successMetric;
  if (input.targetValue !== undefined) values.targetValue = input.targetValue;
  if (input.currentValue !== undefined)
    values.currentValue = input.currentValue;
  if (input.status !== undefined) values.status = input.status;
  if (input.result !== undefined) values.result = input.result;
  if (!Object.keys(values).length) return { id: input.id };
  await db
    .update(ideaLabExperiments)
    .set(values)
    .where(
      and(
        eq(ideaLabExperiments.id, input.id),
        eq(ideaLabExperiments.boardId, input.boardId)
      )
    );
  return { id: input.id };
}

type IdeaLabTaskStatus = "todo" | "in_progress" | "blocked" | "done";
type IdeaLabTaskPriority = "low" | "medium" | "high" | "urgent";

type IdeaLabTaskLinks = {
  problemId?: number | null;
  ideaId?: number | null;
  interviewId?: number | null;
  experimentId?: number | null;
};

export async function createIdeaLabTask(
  input: {
    boardId: number;
    userId: number;
    title: string;
    description?: string | null;
    status?: IdeaLabTaskStatus;
    priority?: IdeaLabTaskPriority;
    dueDate?: Date | null;
    assigneeUserId?: number | null;
  } & IdeaLabTaskLinks
) {
  const db = await database();
  await validateTaskLinks(db, input.boardId, input);
  if (input.assigneeUserId)
    await requireTeamUser(db, input.boardId, input.assigneeUserId);
  const status = input.status ?? "todo";
  const result = await db.insert(ideaLabTasks).values({
    boardId: input.boardId,
    problemId: input.problemId ?? null,
    ideaId: input.ideaId ?? null,
    interviewId: input.interviewId ?? null,
    experimentId: input.experimentId ?? null,
    title: input.title,
    description: input.description || null,
    status,
    priority: input.priority ?? "medium",
    dueDate: input.dueDate ?? null,
    assigneeUserId:
      input.assigneeUserId === undefined ? input.userId : input.assigneeUserId,
    createdByUserId: input.userId,
    completedAt: status === "done" ? new Date() : null,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateIdeaLabTask(
  input: {
    boardId: number;
    id: number;
    title?: string;
    description?: string | null;
    status?: IdeaLabTaskStatus;
    priority?: IdeaLabTaskPriority;
    dueDate?: Date | null;
    assigneeUserId?: number | null;
  } & IdeaLabTaskLinks
) {
  const db = await database();
  const existing = await requireTask(db, input.boardId, input.id);
  const linksToSet = [
    input.problemId,
    input.ideaId,
    input.interviewId,
    input.experimentId,
  ].filter(value => value !== undefined && value !== null);
  const replacesCurrentLink = linksToSet.length === 1;
  const nextLinks: IdeaLabTaskLinks = {
    problemId: replacesCurrentLink
      ? (input.problemId ?? null)
      : input.problemId === undefined
        ? existing.problemId
        : input.problemId,
    ideaId: replacesCurrentLink
      ? (input.ideaId ?? null)
      : input.ideaId === undefined
        ? existing.ideaId
        : input.ideaId,
    interviewId: replacesCurrentLink
      ? (input.interviewId ?? null)
      : input.interviewId === undefined
        ? existing.interviewId
        : input.interviewId,
    experimentId: replacesCurrentLink
      ? (input.experimentId ?? null)
      : input.experimentId === undefined
        ? existing.experimentId
        : input.experimentId,
  };
  await validateTaskLinks(db, input.boardId, nextLinks);
  if (input.assigneeUserId)
    await requireTeamUser(db, input.boardId, input.assigneeUserId);
  const values: Partial<typeof ideaLabTasks.$inferInsert> = {};
  if (replacesCurrentLink) {
    values.problemId = nextLinks.problemId;
    values.ideaId = nextLinks.ideaId;
    values.interviewId = nextLinks.interviewId;
    values.experimentId = nextLinks.experimentId;
  } else {
    if (input.problemId !== undefined) values.problemId = input.problemId;
    if (input.ideaId !== undefined) values.ideaId = input.ideaId;
    if (input.interviewId !== undefined) values.interviewId = input.interviewId;
    if (input.experimentId !== undefined)
      values.experimentId = input.experimentId;
  }
  if (input.title !== undefined) values.title = input.title;
  if (input.description !== undefined) values.description = input.description;
  if (input.status !== undefined) {
    values.status = input.status;
    values.completedAt = input.status === "done" ? new Date() : null;
  }
  if (input.priority !== undefined) values.priority = input.priority;
  if (input.dueDate !== undefined) values.dueDate = input.dueDate;
  if (input.assigneeUserId !== undefined)
    values.assigneeUserId = input.assigneeUserId;
  if (!Object.keys(values).length) return { id: input.id };
  await db
    .update(ideaLabTasks)
    .set(values)
    .where(
      and(
        eq(ideaLabTasks.id, input.id),
        eq(ideaLabTasks.boardId, input.boardId)
      )
    );
  return { id: input.id };
}

export async function getIdeaLabSource(boardId: number, sourceId: number) {
  const db = await database();
  const rows = await db
    .select()
    .from(ideaLabSources)
    .where(
      and(eq(ideaLabSources.id, sourceId), eq(ideaLabSources.boardId, boardId))
    )
    .limit(1);
  if (!rows[0]) throw new Error("لم نعثر على المصدر");
  return rows[0];
}

export async function saveIdeaLabSourceAnalysis(input: {
  boardId: number;
  sourceId: number;
  userId: number;
  extractedText?: string | null;
  summary?: string | null;
  status: "draft" | "failed";
}) {
  const db = await database();
  await getIdeaLabSource(input.boardId, input.sourceId);
  await db
    .update(ideaLabSources)
    .set({
      extractedText: input.extractedText || null,
      aiSummary: input.summary || null,
      aiStatus: input.status,
      analyzedByUserId: input.userId,
    })
    .where(eq(ideaLabSources.id, input.sourceId));
  return { id: input.sourceId, summary: input.summary || null };
}

export async function approveIdeaLabSourceAnalysis(
  boardId: number,
  sourceId: number
) {
  const db = await database();
  await getIdeaLabSource(boardId, sourceId);
  await db
    .update(ideaLabSources)
    .set({ aiStatus: "approved" })
    .where(eq(ideaLabSources.id, sourceId));
  return { id: sourceId };
}

export async function getUserAiSetting(userId: number) {
  const db = await database();
  const rows = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);
  return rows[0];
}

export async function saveUserAiSetting(input: {
  userId: number;
  encryptedApiKey: string;
  apiKeyLastFour: string;
  model: string;
}) {
  const db = await database();
  await db
    .insert(userAiSettings)
    .values({
      userId: input.userId,
      encryptedApiKey: input.encryptedApiKey,
      apiKeyLastFour: input.apiKeyLastFour,
      model: input.model,
    })
    .onDuplicateKeyUpdate({
      set: {
        encryptedApiKey: input.encryptedApiKey,
        apiKeyLastFour: input.apiKeyLastFour,
        model: input.model,
      },
    });
  return {
    configured: true,
    lastFour: input.apiKeyLastFour,
    model: input.model,
  };
}

export async function deleteUserAiSetting(userId: number) {
  const db = await database();
  await db.delete(userAiSettings).where(eq(userAiSettings.userId, userId));
  return { configured: false };
}

async function requireProblem(
  db: Awaited<ReturnType<typeof database>>,
  boardId: number,
  problemId: number
) {
  const rows = await db
    .select({ id: ideaLabProblems.id })
    .from(ideaLabProblems)
    .where(
      and(
        eq(ideaLabProblems.id, problemId),
        eq(ideaLabProblems.boardId, boardId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("المشكلة غير موجودة في هذه اللوحة");
}

async function requireIdea(
  db: Awaited<ReturnType<typeof database>>,
  boardId: number,
  ideaId: number
) {
  const rows = await db
    .select({ id: ideaLabIdeas.id })
    .from(ideaLabIdeas)
    .where(and(eq(ideaLabIdeas.id, ideaId), eq(ideaLabIdeas.boardId, boardId)))
    .limit(1);
  if (!rows[0]) throw new Error("الفكرة غير موجودة في هذه اللوحة");
}

async function requireInterview(
  db: Awaited<ReturnType<typeof database>>,
  boardId: number,
  interviewId: number
) {
  const rows = await db
    .select({ id: ideaLabInterviews.id })
    .from(ideaLabInterviews)
    .where(
      and(
        eq(ideaLabInterviews.id, interviewId),
        eq(ideaLabInterviews.boardId, boardId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("المقابلة غير موجودة في هذه اللوحة");
}

async function requireExperiment(
  db: Awaited<ReturnType<typeof database>>,
  boardId: number,
  experimentId: number
) {
  const rows = await db
    .select({ id: ideaLabExperiments.id })
    .from(ideaLabExperiments)
    .where(
      and(
        eq(ideaLabExperiments.id, experimentId),
        eq(ideaLabExperiments.boardId, boardId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("التجربة غير موجودة في هذه اللوحة");
}

async function requireTask(
  db: Awaited<ReturnType<typeof database>>,
  boardId: number,
  taskId: number
) {
  const rows = await db
    .select({
      id: ideaLabTasks.id,
      problemId: ideaLabTasks.problemId,
      ideaId: ideaLabTasks.ideaId,
      interviewId: ideaLabTasks.interviewId,
      experimentId: ideaLabTasks.experimentId,
    })
    .from(ideaLabTasks)
    .where(and(eq(ideaLabTasks.id, taskId), eq(ideaLabTasks.boardId, boardId)))
    .limit(1);
  if (!rows[0]) throw new Error("المهمة غير موجودة في هذه اللوحة");
  return rows[0];
}

async function requireTeamUser(
  db: Awaited<ReturnType<typeof database>>,
  boardId: number,
  userId: number
) {
  const rows = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.boardId, boardId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.isActive, true)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("المسند إليه ليس عضوًا نشطًا في هذه اللوحة");
}

async function validateTaskLinks(
  db: Awaited<ReturnType<typeof database>>,
  boardId: number,
  links: IdeaLabTaskLinks
) {
  const selectedLinks = [
    links.problemId,
    links.ideaId,
    links.interviewId,
    links.experimentId,
  ].filter(value => value !== undefined && value !== null);
  if (selectedLinks.length > 1) throw new Error("اربط المهمة بسجل واحد فقط");
  if (links.problemId) await requireProblem(db, boardId, links.problemId);
  if (links.ideaId) await requireIdea(db, boardId, links.ideaId);
  if (links.interviewId) await requireInterview(db, boardId, links.interviewId);
  if (links.experimentId)
    await requireExperiment(db, boardId, links.experimentId);
}
