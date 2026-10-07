import { and, eq } from "drizzle-orm";
import {
  ideaLabConsultations,
  ideaLabIdeas,
  ideaLabTasks,
} from "../drizzle/schema";
import type { ConsultationFields } from "../shared/consultations";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  return db;
}
export async function saveConsultation(
  input: ConsultationFields & {
    boardId: number;
    ideaId: number;
    userId: number;
    id?: number;
    version?: number;
  }
) {
  const db = await database();
  const [idea] = await db
    .select({ id: ideaLabIdeas.id })
    .from(ideaLabIdeas)
    .where(
      and(
        eq(ideaLabIdeas.id, input.ideaId),
        eq(ideaLabIdeas.boardId, input.boardId)
      )
    )
    .limit(1);
  if (!idea) throw new Error("الفكرة غير موجودة في هذه اللوحة");
  const { boardId, ideaId, userId, id, version, ...fields } = input;
  if (id) {
    if (!version) throw new Error("يلزم تحديث الاستشارة قبل حفظها");
    const result = await db
      .update(ideaLabConsultations)
      .set({ ...fields, version: version + 1 })
      .where(
        and(
          eq(ideaLabConsultations.id, id),
          eq(ideaLabConsultations.boardId, boardId),
          eq(ideaLabConsultations.ideaId, ideaId),
          eq(ideaLabConsultations.version, version)
        )
      );
    if (!result[0].affectedRows)
      throw new Error(
        "تغيرت الاستشارة لدى عضو آخر أو لم تعد متاحة. أعد فتحها قبل الحفظ."
      );
    return { id, version: version + 1 };
  }
  const result = await db
    .insert(ideaLabConsultations)
    .values({ ...fields, boardId, ideaId, createdByUserId: userId });
  return { id: Number(result[0].insertId), version: 1 };
}
export async function deleteConsultation(boardId: number, id: number) {
  const db = await database();
  const result = await db
    .delete(ideaLabConsultations)
    .where(
      and(
        eq(ideaLabConsultations.id, id),
        eq(ideaLabConsultations.boardId, boardId)
      )
    );
  if (!result[0].affectedRows)
    throw new Error("الاستشارة غير موجودة في هذه اللوحة");
  return { id };
}
export async function consultationToTask(
  boardId: number,
  id: number,
  userId: number
) {
  const db = await database();
  return db.transaction(async tx => {
    const [item] = await tx
      .select()
      .from(ideaLabConsultations)
      .where(
        and(
          eq(ideaLabConsultations.id, id),
          eq(ideaLabConsultations.boardId, boardId)
        )
      )
      .limit(1)
      .for("update");
    if (!item) throw new Error("الاستشارة غير موجودة في هذه اللوحة");
    if (item.taskId) return { id: item.taskId };
    if (!item.recommendations.trim())
      throw new Error("أضف التوصيات واحفظ الاستشارة أولًا");
    const result = await tx
      .insert(ideaLabTasks)
      .values({
        boardId,
        ideaId: item.ideaId,
        title: `متابعة استشارة: ${item.title}`.slice(0, 280),
        description: item.recommendations,
        createdByUserId: userId,
        assigneeUserId: userId,
      });
    const taskId = Number(result[0].insertId);
    await tx
      .update(ideaLabConsultations)
      .set({ taskId })
      .where(eq(ideaLabConsultations.id, id));
    return { id: taskId };
  });
}
