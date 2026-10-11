import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  managementBoards,
  personalLifeCategories as categories,
  personalLifeTasks as tasks,
} from "../drizzle/schema";
import {
  personalTaskFields,
  personalCategories,
  personalToday,
} from "../shared/personal";
import type { z } from "zod";
async function database(boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const [board] = await db
    .select()
    .from(managementBoards)
    .where(eq(managementBoards.id, boardId));
  if (board?.template !== "personal")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "هذه ليست لوحة شخصية",
    });
  return db;
}
export async function overview(boardId: number, userId: number) {
  const db = await database(boardId);
  const where = and(
    eq(categories.boardId, boardId),
    eq(categories.userId, userId)
  );
  const [existing] = await db.select().from(categories).where(where).limit(1);
  if (!existing) {
    await db.transaction(async tx => {
      await tx
        .select()
        .from(managementBoards)
        .where(eq(managementBoards.id, boardId))
        .for("update");
      const [found] = await tx.select().from(categories).where(where).limit(1);
      if (!found)
        await tx
          .insert(categories)
          .values(personalCategories.map(name => ({ boardId, userId, name })));
    });
  }
  const [lifeCategories, lifeTasks] = await Promise.all([
    db.select().from(categories).where(where).orderBy(categories.id),
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.boardId, boardId), eq(tasks.userId, userId)))
      .orderBy(tasks.id),
  ]);
  return {
    categories: lifeCategories,
    tasks: lifeTasks,
    today: personalToday(),
  };
}
export async function saveCategory(
  boardId: number,
  userId: number,
  input: { id?: number; name: string }
) {
  const db = await database(boardId);
  if (input.id) {
    const result = await db
      .update(categories)
      .set({ name: input.name })
      .where(
        and(
          eq(categories.id, input.id),
          eq(categories.boardId, boardId),
          eq(categories.userId, userId)
        )
      );
    if (!result[0].affectedRows)
      throw new TRPCError({ code: "NOT_FOUND", message: "التصنيف غير متاح" });
    return;
  }
  await db.insert(categories).values({ boardId, userId, name: input.name });
}
export async function saveTask(
  boardId: number,
  userId: number,
  input: z.infer<typeof personalTaskFields> & { id?: number; version?: number }
) {
  const db = await database(boardId);
  await db.transaction(async tx => {
    if (input.categoryId) {
      const [category] = await tx
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, input.categoryId),
            eq(categories.boardId, boardId),
            eq(categories.userId, userId)
          )
        );
      if (!category)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "اختر تصنيفًا من لوحتك",
        });
    }
    const { id, version, ...fields } = input;
    if (!id) {
      await tx.insert(tasks).values({ ...fields, boardId, userId });
      return;
    }
    const result = await tx
      .update(tasks)
      .set({ ...fields, version: sql`${tasks.version}+1` })
      .where(
        and(
          eq(tasks.id, id),
          eq(tasks.boardId, boardId),
          eq(tasks.userId, userId),
          eq(tasks.version, version ?? 0)
        )
      );
    if (!result[0].affectedRows)
      throw new TRPCError({
        code: "CONFLICT",
        message: "تغيرت المهمة. أعد فتحها قبل الحفظ",
      });
  });
}
export async function setState(
  boardId: number,
  userId: number,
  input: { id: number; version: number; done?: boolean; focus?: boolean }
) {
  const db = await database(boardId);
  const result = await db
    .update(tasks)
    .set({
      ...(input.done !== undefined ? { done: input.done } : {}),
      ...(input.focus !== undefined
        ? { focusDate: input.focus ? personalToday() : null }
        : {}),
      version: sql`${tasks.version}+1`,
    })
    .where(
      and(
        eq(tasks.id, input.id),
        eq(tasks.boardId, boardId),
        eq(tasks.userId, userId),
        eq(tasks.version, input.version)
      )
    );
  if (!result[0].affectedRows)
    throw new TRPCError({
      code: "CONFLICT",
      message: "تغيرت المهمة، حدّث القائمة وحاول مرة أخرى",
    });
}
