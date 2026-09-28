import { and, desc, eq } from "drizzle-orm";
import {
  ideaLabExperiments,
  ideaLabIdeas,
  ideaLabInterviews,
  ideaLabProblems,
  ideaLabSources,
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
  const [board, problems, ideas, sources, interviews, experiments, members] =
    await Promise.all([
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
  stage?: "raw" | "understanding" | "validated";
  evidenceStrength?: "none" | "low" | "medium" | "high";
}) {
  const db = await database();
  await requireProblem(db, input.boardId, input.id);
  const values: Partial<typeof ideaLabProblems.$inferInsert> = {};
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
  const values: Partial<typeof ideaLabIdeas.$inferInsert> = {};
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
