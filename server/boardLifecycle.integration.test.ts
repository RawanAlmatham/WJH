import { describe, beforeAll, it, expect } from "vitest";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { appRouter } from "./routers";
import {
  getDb,
  createManagementBoard,
  joinManagementBoard,
  selectManagementBoard,
  getActiveBoardId,
  listUserBoards,
  hasBoardRole,
  getBoardByInviteToken,
} from "./db";
import {
  users,
  boardMemberships,
  managementBoards,
  businessRecords,
  teamMembers,
} from "../drizzle/schema";
import { businessData } from "../shared/business";
describe.skipIf(
  process.env.COMMERCE_INTEGRATION_TEST !== "1" ||
    !process.env.DATABASE_URL?.endsWith("/wjh_commerce_test")
)("board leave, trash and recovery", () => {
  let owner: typeof users.$inferSelect,
    member: typeof users.$inferSelect,
    viewer: typeof users.$inferSelect,
    outsider: typeof users.$inferSelect;
  const caller = (user: typeof users.$inferSelect) =>
    appRouter.createCaller({
      user,
      req: { headers: {} } as any,
      res: {} as any,
    });
  beforeAll(async () => {
    const db = (await getDb())!,
      accounts = [];
    for (const name of ["المالك", "عضو", "مشاهد", "خارج اللوحة"]) {
      const id = Number(
        (await db.insert(users).values({ openId: nanoid(), name }))[0].insertId
      );
      accounts.push((await db.select().from(users).where(eq(users.id, id)))[0]);
    }
    [owner, member, viewer, outsider] = accounts;
  });
  it("removes only the departing membership and keeps linked work", async () => {
    const board = await createManagementBoard(
      "لوحة مشتركة",
      owner.id,
      "business"
    );
    await joinManagementBoard(board.id, member.id);
    await joinManagementBoard(board.id, viewer.id, "viewer");
    const t = await caller(member).business.save({
      boardId: board.id,
      kind: "task",
      data: businessData.parse({
        title: "عمل العضو",
        assigneeUserId: member.id,
      }),
    });
    await caller(member).boards.leave({ boardId: board.id });
    expect((await listUserBoards(member.id)).some(b => b.id === board.id)).toBe(
      false
    );
    await expect(
      caller(member).business.overview({ boardId: board.id })
    ).rejects.toThrow();
    expect(
      (
        await caller(owner).business.overview({ boardId: board.id })
      ).records.find(r => r.id === t.id)?.data.title
    ).toBe("عمل العضو");
    await caller(viewer).boards.leave({ boardId: board.id });
    expect(await hasBoardRole(viewer.id, ["viewer"], board.id)).toBe(false);
    expect(
      (await caller(owner).boards.management()).boards.find(
        b => b.id === board.id
      )?.members
    ).toHaveLength(1);
  });
  it("requires a valid successor for the last manager and transfers ownership atomically", async () => {
    const board = await createManagementBoard(
      "تسليم الإدارة",
      owner.id,
      "business"
    );
    await joinManagementBoard(board.id, member.id);
    await joinManagementBoard(board.id, viewer.id, "viewer");
    await expect(
      caller(owner).boards.leave({ boardId: board.id })
    ).rejects.toThrow();
    await expect(
      caller(owner).boards.leave({
        boardId: board.id,
        successorUserId: outsider.id,
      })
    ).rejects.toThrow();
    await expect(
      caller(owner).boards.leave({
        boardId: board.id,
        successorUserId: viewer.id,
      })
    ).rejects.toThrow();
    await caller(owner).boards.leave({
      boardId: board.id,
      successorUserId: member.id,
    });
    expect(await hasBoardRole(member.id, ["manager"], board.id)).toBe(true);
    expect(await hasBoardRole(owner.id, ["manager"], board.id)).toBe(false);
    const [persisted] = await (await getDb())!
      .select()
      .from(managementBoards)
      .where(eq(managementBoards.id, board.id));
    expect(persisted.ownerUserId).toBe(member.id);
  });
  it("never leaves a board with no manager during simultaneous departures", async () => {
    const board = await createManagementBoard(
      "تزامن المغادرة",
      owner.id,
      "personal"
    );
    await joinManagementBoard(board.id, member.id, "manager");
    const results = await Promise.allSettled([
      caller(owner).boards.leave({ boardId: board.id }),
      caller(member).boards.leave({ boardId: board.id }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const remaining = await (await getDb())!
      .select()
      .from(boardMemberships)
      .where(eq(boardMemberships.boardId, board.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].role).toBe("manager");
  });
  it("requires manager permission and exact confirmation; trash blocks all access and join routes", async () => {
    const board = await createManagementBoard(
      "حذف واستعادة",
      owner.id,
      "business"
    );
    await joinManagementBoard(board.id, member.id);
    await joinManagementBoard(board.id, viewer.id, "viewer");
    await selectManagementBoard(owner.id, board.id);
    const t = await caller(owner).business.save({
      boardId: board.id,
      kind: "task",
      data: businessData.parse({ title: "لا تفقدني" }),
    });
    await expect(
      caller(member).boards.delete({
        boardId: board.id,
        confirmName: board.name,
      })
    ).rejects.toThrow();
    await expect(
      caller(outsider).boards.delete({
        boardId: board.id,
        confirmName: board.name,
      })
    ).rejects.toThrow();
    await expect(
      caller(owner).boards.delete({
        boardId: board.id,
        confirmName: "غير صحيح",
      })
    ).rejects.toThrow();
    await caller(owner).boards.delete({
      boardId: board.id,
      confirmName: board.name,
    });
    expect((await listUserBoards(owner.id)).some(b => b.id === board.id)).toBe(
      false
    );
    expect((await listUserBoards(member.id)).some(b => b.id === board.id)).toBe(
      false
    );
    expect(await getActiveBoardId(owner.id)).not.toBe(board.id);
    await expect(selectManagementBoard(owner.id, board.id)).rejects.toThrow();
    expect(await getBoardByInviteToken(board.inviteToken)).toBeNull();
    await expect(joinManagementBoard(board.id, outsider.id)).rejects.toThrow();
    await expect(
      caller(member).business.overview({ boardId: board.id })
    ).rejects.toThrow();
    expect(await hasBoardRole(owner.id, ["manager"], board.id)).toBe(false);
    expect(
      (await caller(owner).boards.management()).deleted.some(
        b => b.id === board.id
      )
    ).toBe(true);
    expect(
      (await caller(member).boards.management()).deleted.some(
        b => b.id === board.id
      )
    ).toBe(false);
    await expect(
      caller(member).boards.restore({ boardId: board.id })
    ).rejects.toThrow();
    await caller(owner).boards.restore({ boardId: board.id });
    expect(
      (
        await caller(owner).business.overview({ boardId: board.id })
      ).records.find(r => r.id === t.id)?.data.title
    ).toBe("لا تفقدني");
    expect(await hasBoardRole(member.id, ["member"], board.id)).toBe(true);
    await selectManagementBoard(owner.id, board.id);
  });
  it("works for every template and offers recovery when the last board is deleted", async () => {
    const db = (await getDb())!,
      id = Number(
        (
          await db
            .insert(users)
            .values({ openId: nanoid(), name: "مستخدم لوحاته فارغة" })
        )[0].insertId
      );
    const user = (await db.select().from(users).where(eq(users.id, id)))[0];
    for (const template of [
      "personal",
      "idea_lab",
      "commerce_import",
      "business",
      "work",
    ]) {
      const b = await createManagementBoard("قالب " + template, id, template);
      await caller(user).boards.delete({ boardId: b.id, confirmName: b.name });
      expect(await getActiveBoardId(id)).toBeNull();
      expect(
        (await caller(user).boards.management()).deleted.some(
          d => d.id === b.id
        )
      ).toBe(true);
      await caller(user).boards.restore({ boardId: b.id });
      expect(await getActiveBoardId(id)).toBe(b.id);
      await caller(user).boards.delete({ boardId: b.id, confirmName: b.name });
    }
  });
});
