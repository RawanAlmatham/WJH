import { and, eq, isNotNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb, listUserBoards } from "./db";
import {
  managementBoards,
  boardMemberships,
  teamMembers,
  teamInvitations,
  users,
} from "../drizzle/schema";
function fail(
  message: string,
  code: "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" = "BAD_REQUEST"
): never {
  throw new TRPCError({ code, message });
}
async function database() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db;
}
export async function list(userId: number) {
  const db = await database();
  const [boards, deleted, members] = await Promise.all([
    listUserBoards(userId),
    db
      .select({
        id: managementBoards.id,
        name: managementBoards.name,
        deletedAt: managementBoards.deletedAt,
        template: managementBoards.template,
      })
      .from(managementBoards)
      .innerJoin(
        boardMemberships,
        eq(boardMemberships.boardId, managementBoards.id)
      )
      .where(
        and(
          eq(boardMemberships.userId, userId),
          eq(boardMemberships.role, "manager"),
          isNotNull(managementBoards.deletedAt)
        )
      ),
    db
      .select({
        boardId: boardMemberships.boardId,
        userId: users.id,
        name: users.name,
        role: boardMemberships.role,
      })
      .from(boardMemberships)
      .innerJoin(users, eq(boardMemberships.userId, users.id))
      .where(
        inArray(
          boardMemberships.boardId,
          db
            .select({ boardId: boardMemberships.boardId })
            .from(boardMemberships)
            .where(eq(boardMemberships.userId, userId))
        )
      ),
  ]);
  return {
    boards: boards.map(b => ({
      ...b,
      members: members
        .filter(m => m.boardId === b.id)
        .map(({ boardId: _, ...m }) => m),
    })),
    deleted,
  };
}
export async function leave(
  userId: number,
  input: { boardId: number; successorUserId?: number }
) {
  const db = await database();
  return db.transaction(async tx => {
    const [board] = await tx
      .select()
      .from(managementBoards)
      .where(eq(managementBoards.id, input.boardId))
      .for("update");
    if (!board || board.deletedAt) fail("اللوحة غير متاحة", "NOT_FOUND");
    const members = await tx
      .select()
      .from(boardMemberships)
      .where(eq(boardMemberships.boardId, input.boardId))
      .for("update");
    const me = members.find(m => m.userId === userId);
    if (!me) fail("أنت لست عضوًا في هذه اللوحة", "FORBIDDEN");
    const managers = members.filter(
      m => m.userId !== userId && m.role === "manager"
    );
    if (me.role === "manager" && !managers.length) {
      const successor = members.find(
        m =>
          m.userId === input.successorUserId &&
          m.userId !== userId &&
          m.role === "member"
      );
      if (!successor)
        fail(
          "أنت آخر مدير. اختر عضوًا يتولى الإدارة، أو احذف اللوحة إذا لم تعد تحتاجها"
        );
      await tx
        .update(boardMemberships)
        .set({ role: "manager" })
        .where(eq(boardMemberships.id, successor.id));
      await tx
        .update(teamMembers)
        .set({ projectAccess: "all", allowedProjectIds: null })
        .where(
          and(
            eq(teamMembers.boardId, board.id),
            eq(teamMembers.userId, successor.userId)
          )
        );
      if (board.ownerUserId === userId)
        await tx
          .update(managementBoards)
          .set({ ownerUserId: successor.userId })
          .where(eq(managementBoards.id, board.id));
    } else if (board.ownerUserId === userId) {
      if (!managers.length) fail("عيّن مديرًا آخر قبل المغادرة");
      await tx
        .update(managementBoards)
        .set({ ownerUserId: managers[0].userId })
        .where(eq(managementBoards.id, board.id));
    }
    await tx.delete(boardMemberships).where(eq(boardMemberships.id, me.id));
    await tx
      .update(teamMembers)
      .set({ isActive: false })
      .where(
        and(eq(teamMembers.boardId, board.id), eq(teamMembers.userId, userId))
      );
    await tx
      .update(users)
      .set({ activeBoardId: null })
      .where(and(eq(users.id, userId), eq(users.activeBoardId, board.id)));
    return { success: true };
  });
}
export async function trash(
  userId: number,
  input: { boardId: number; confirmName: string }
) {
  const db = await database();
  return db.transaction(async tx => {
    const [board] = await tx
      .select()
      .from(managementBoards)
      .where(eq(managementBoards.id, input.boardId))
      .for("update");
    if (!board || board.deletedAt) fail("اللوحة غير متاحة", "NOT_FOUND");
    const [me] = await tx
      .select()
      .from(boardMemberships)
      .where(
        and(
          eq(boardMemberships.boardId, board.id),
          eq(boardMemberships.userId, userId)
        )
      )
      .for("update");
    if (me?.role !== "manager")
      fail("حذف اللوحة متاح لمديرها فقط", "FORBIDDEN");
    if (input.confirmName !== board.name)
      fail("اكتب اسم اللوحة كما هو لتأكيد الحذف");
    await tx
      .update(managementBoards)
      .set({ deletedAt: new Date() })
      .where(eq(managementBoards.id, board.id));
    // Cancel old pending invitations; a restored board can issue fresh invitations.
    await tx
      .update(teamInvitations)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(teamInvitations.boardId, board.id),
          eq(teamInvitations.status, "pending")
        )
      );
    await tx
      .update(users)
      .set({ activeBoardId: null })
      .where(eq(users.activeBoardId, board.id));
    return { success: true };
  });
}
export async function restore(userId: number, boardId: number) {
  const db = await database();
  return db.transaction(async tx => {
    const [board] = await tx
      .select()
      .from(managementBoards)
      .where(eq(managementBoards.id, boardId))
      .for("update");
    const [me] = await tx
      .select()
      .from(boardMemberships)
      .where(
        and(
          eq(boardMemberships.boardId, boardId),
          eq(boardMemberships.userId, userId)
        )
      )
      .for("update");
    if (!board?.deletedAt || me?.role !== "manager")
      fail("اللوحة غير متاحة للاستعادة", "FORBIDDEN");
    await tx
      .update(managementBoards)
      .set({ deletedAt: null })
      .where(eq(managementBoards.id, boardId));
    return { success: true };
  });
}
