import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import {
  commerceResources,
  commerceSections,
  commerceTasks,
  managementBoards,
  teamMembers,
  boardMemberships,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  commerceStarterSections,
  reorderCommerceSections,
  commerceTaskFields,
  commerceResourceFields,
} from "../shared/commerce";
import type { z } from "zod";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db;
}
export async function requireCommerceBoard(boardId: number) {
  const db = await database();
  const [board] = await db
    .select()
    .from(managementBoards)
    .where(eq(managementBoards.id, boardId));
  if (board?.template !== "commerce_import")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "هذه اللوحة ليست من قالب تأسيس تجارة واستيراد",
    });
  return db;
}
export async function overview(boardId: number) {
  const db = await requireCommerceBoard(boardId);
  const [sections, tasks, resources, members] = await Promise.all([
    db
      .select()
      .from(commerceSections)
      .where(eq(commerceSections.boardId, boardId))
      .orderBy(commerceSections.position, commerceSections.id),
    db
      .select()
      .from(commerceTasks)
      .where(eq(commerceTasks.boardId, boardId))
      .orderBy(desc(commerceTasks.updatedAt)),
    db
      .select()
      .from(commerceResources)
      .where(eq(commerceResources.boardId, boardId))
      .orderBy(desc(commerceResources.createdAt)),
    db
      .select()
      .from(teamMembers)
      .where(
        and(eq(teamMembers.boardId, boardId), eq(teamMembers.isActive, true))
      )
      .orderBy(teamMembers.name),
  ]);
  return { sections, tasks, resources, members };
}
export async function createCommerceBoard(
  name: string,
  userId: number,
  starterTasks: boolean
) {
  const db = await database();
  return db.transaction(async tx => {
    const joinCode = nanoid(8).toUpperCase();
    const inviteToken = nanoid(32);
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    const result = await tx
      .insert(managementBoards)
      .values({
        name,
        ownerUserId: userId,
        template: "commerce_import",
        joinCode,
        inviteToken,
        enabledModules: [],
        presentationSections: [],
      });
    const boardId = Number(result[0].insertId);
    await tx
      .insert(boardMemberships)
      .values({ boardId, userId, role: "manager" });
    await tx
      .insert(teamMembers)
      .values({
        boardId,
        userId,
        name: user?.name || "عضو فريق",
        email: user?.email,
        role: "مدير المساحة",
        avatarInitials: user?.name?.slice(0, 2) || "و",
      });
    for (const [position, section] of Array.from(
      commerceStarterSections.entries()
    )) {
      const inserted = await tx
        .insert(commerceSections)
        .values({ boardId, name: section.name, position });
      if (starterTasks)
        await tx
          .insert(commerceTasks)
          .values(
            section.tasks.map(title => ({
              boardId,
              sectionId: Number(inserted[0].insertId),
              title,
              assigneeUserId: userId,
              createdByUserId: userId,
              checklist: [],
            }))
          );
    }
    await tx
      .update(users)
      .set({ activeBoardId: boardId })
      .where(eq(users.id, userId));
    return {
      id: boardId,
      name,
      template: "commerce_import",
      joinCode,
      inviteToken,
      enabledModules: [],
      presentationSections: [],
      membershipRole: "manager" as const,
    };
  });
}
export async function saveSection(
  boardId: number,
  input: { id?: number; name: string }
) {
  const db = await requireCommerceBoard(boardId);
  if (input.id) {
    await requireSection(db, boardId, input.id);
    await db
      .update(commerceSections)
      .set({ name: input.name })
      .where(
        and(
          eq(commerceSections.boardId, boardId),
          eq(commerceSections.id, input.id)
        )
      );
    return { id: input.id };
  }
  const all = await db
    .select({ position: commerceSections.position })
    .from(commerceSections)
    .where(eq(commerceSections.boardId, boardId));
  const result = await db
    .insert(commerceSections)
    .values({
      boardId,
      name: input.name,
      position: Math.max(-1, ...all.map(s => s.position)) + 1,
    });
  return { id: Number(result[0].insertId) };
}
async function requireSection(
  db: Awaited<ReturnType<typeof database>>,
  boardId: number,
  id: number
) {
  const [section] = await db
    .select()
    .from(commerceSections)
    .where(
      and(eq(commerceSections.boardId, boardId), eq(commerceSections.id, id))
    );
  if (!section)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "لم نعثر على القسم في هذه اللوحة",
    });
  return section;
}
export async function archiveSection(
  boardId: number,
  id: number,
  archived: boolean
) {
  const db = await requireCommerceBoard(boardId);
  await requireSection(db, boardId, id);
  await db
    .update(commerceSections)
    .set({ archived })
    .where(
      and(eq(commerceSections.boardId, boardId), eq(commerceSections.id, id))
    );
}
export async function moveSection(
  boardId: number,
  id: number,
  direction: "up" | "down"
) {
  const db = await requireCommerceBoard(boardId);
  await db.transaction(async tx => {
    const sections = await tx
      .select()
      .from(commerceSections)
      .where(eq(commerceSections.boardId, boardId))
      .orderBy(commerceSections.position, commerceSections.id)
      .for("update");
    if (!sections.some(s => s.id === id && !s.archived))
      throw new TRPCError({ code: "NOT_FOUND", message: "القسم غير متاح" });
    const ids = reorderCommerceSections(
      sections.filter(s => !s.archived).map(s => s.id),
      id,
      direction
    );
    for (const [position, sectionId] of Array.from(ids.entries()))
      await tx
        .update(commerceSections)
        .set({ position })
        .where(
          and(
            eq(commerceSections.boardId, boardId),
            eq(commerceSections.id, sectionId)
          )
        );
  });
}
export async function saveTask(
  boardId: number,
  userId: number,
  input: z.infer<typeof commerceTaskFields> & { id?: number; version?: number }
) {
  const db = await requireCommerceBoard(boardId);
  const section = await requireSection(db, boardId, input.sectionId);
  if (section.archived)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "استعد القسم قبل إضافة أو تعديل مهامه",
    });
  if (input.assigneeUserId !== null) {
    const [membership] = await db
      .select()
      .from(boardMemberships)
      .where(
        and(
          eq(boardMemberships.boardId, boardId),
          eq(boardMemberships.userId, input.assigneeUserId)
        )
      );
    if (!membership || membership.role === "viewer")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "اختر مسؤولًا من أعضاء هذه اللوحة",
      });
  }
  const { id, version, ...fields } = input;
  if (!id) {
    const result = await db
      .insert(commerceTasks)
      .values({
        ...fields,
        boardId,
        createdByUserId: userId,
        completedAt: fields.status === "done" ? new Date() : null,
      });
    return { id: Number(result[0].insertId) };
  }
  const [task] = await db
    .select()
    .from(commerceTasks)
    .where(and(eq(commerceTasks.boardId, boardId), eq(commerceTasks.id, id)));
  if (!task)
    throw new TRPCError({ code: "NOT_FOUND", message: "المهمة غير متاحة" });
  const updated = await db
    .update(commerceTasks)
    .set({
      ...fields,
      version: task.version + 1,
      completedAt:
        fields.status === "done" ? (task.completedAt ?? new Date()) : null,
    })
    .where(
      and(
        eq(commerceTasks.boardId, boardId),
        eq(commerceTasks.id, id),
        eq(commerceTasks.version, version ?? 0)
      )
    );
  if (!updated[0].affectedRows)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "عدّل أحد أعضاء الفريق هذه المهمة. أغلقها وافتح النسخة الجديدة قبل الحفظ.",
    });
  return { id };
}
export async function archiveTask(
  boardId: number,
  id: number,
  archived: boolean
) {
  const db = await requireCommerceBoard(boardId);
  const result = await db
    .update(commerceTasks)
    .set({ archived, version: sql`${commerceTasks.version} + 1` })
    .where(and(eq(commerceTasks.boardId, boardId), eq(commerceTasks.id, id)));
  if (!result[0].affectedRows)
    throw new TRPCError({ code: "NOT_FOUND", message: "المهمة غير متاحة" });
}
export async function saveResource(
  boardId: number,
  userId: number,
  input: z.infer<typeof commerceResourceFields>
) {
  const db = await requireCommerceBoard(boardId);
  await db
    .insert(commerceResources)
    .values({ ...input, boardId, createdByUserId: userId });
}
export async function archiveResource(
  boardId: number,
  id: number,
  archived: boolean
) {
  const db = await requireCommerceBoard(boardId);
  await db
    .update(commerceResources)
    .set({ archived })
    .where(
      and(eq(commerceResources.boardId, boardId), eq(commerceResources.id, id))
    );
}
