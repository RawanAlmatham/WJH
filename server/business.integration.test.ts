import { beforeAll, describe, it, expect } from "vitest";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb, createManagementBoard, selectManagementBoard } from "./db";
import { appRouter } from "./routers";
import { users, boardMemberships, assistantDrafts } from "../drizzle/schema";
import {
  businessData,
  businessTotals,
  type BusinessKind,
} from "../shared/business";
import { boardContext } from "./assistantBoard";
import { assistantAction } from "../shared/assistant";
describe.skipIf(
  process.env.COMMERCE_INTEGRATION_TEST !== "1" ||
    !process.env.DATABASE_URL?.endsWith("/wjh_commerce_test")
)("business persistence and isolation", () => {
  let owner: typeof users.$inferSelect,
    viewer: typeof users.$inferSelect,
    outsider: typeof users.$inferSelect,
    boardId: number,
    otherBoardId: number;
  const caller = (user: typeof users.$inferSelect) =>
    appRouter.createCaller({
      user,
      req: { headers: {} } as any,
      res: {} as any,
    });
  const rows = async () =>
    (await caller(owner).business.overview({ boardId })).records;
  const add = async (kind: BusinessKind, extra: Record<string, unknown> = {}) =>
    caller(owner).business.save({
      boardId,
      kind,
      data: businessData.parse({ title: "اختبار " + kind, ...extra }),
    });
  beforeAll(async () => {
    const db = (await getDb())!,
      accounts = [];
    for (const name of ["مالك", "مشاهد", "خارج الفريق"]) {
      const id = Number(
        (await db.insert(users).values({ openId: nanoid(), name }))[0].insertId
      );
      accounts.push((await db.select().from(users).where(eq(users.id, id)))[0]);
    }
    [owner, viewer, outsider] = accounts;
    boardId = (
      await createManagementBoard("أعمال الاختبار", owner.id, "business")
    ).id;
    otherBoardId = (
      await createManagementBoard("أعمال أخرى", owner.id, "business")
    ).id;
    await selectManagementBoard(owner.id, boardId);
    await db
      .insert(boardMemberships)
      .values({ boardId, userId: viewer.id, role: "viewer" });
  });
  it("starts empty and refuses outsider access and viewer writes", async () => {
    expect(await rows()).toHaveLength(0);
    expect(
      (await caller(viewer).business.overview({ boardId })).records
    ).toHaveLength(0);
    await expect(
      caller(outsider).business.overview({ boardId })
    ).rejects.toThrow();
    await expect(
      caller(viewer).business.save({
        boardId,
        kind: "idea",
        data: businessData.parse({ title: "ممنوع" }),
      })
    ).rejects.toThrow();
  });
  it("persists records, rejects cross-board links and stale edits, converts once", async () => {
    const idea = await add("idea", { nextStep: "اختبر الطلب" });
    const r = (await rows()).find(r => r.id === idea.id)!;
    const converted = await caller(owner).business.action({
      boardId,
      id: r.id,
      version: r.version,
      action: "convert",
    });
    await expect(
      caller(owner).business.action({
        boardId,
        id: r.id,
        version: r.version,
        action: "convert",
      })
    ).rejects.toThrow();
    const after = (await rows()).find(
      r => r.id === idea.id && r.kind === "idea"
    )!;
    expect(after.convertedProjectId).toBe(converted.id);
    await expect(
      caller(owner).business.save({
        boardId: otherBoardId,
        kind: "task",
        data: businessData.parse({ title: "خارجي", projectId: converted.id }),
      })
    ).rejects.toThrow();
    const t = await add("task", { projectId: converted.id });
    const task = (await rows()).find(r => r.id === t.id)!;
    await caller(owner).business.save({
      ...task,
      boardId,
      data: { ...task.data, title: "معدل" },
    });
    await expect(
      caller(owner).business.save({ ...task, boardId })
    ).rejects.toThrow();
  });
  it("settles obligations once and reimburses personal expenses without losing history", async () => {
    await add("contribution", { amount: 1000, assigneeUserId: owner.id });
    const o = await add("obligation", { amount: 200, status: "قائم" });
    let r = (await rows()).find(r => r.id === o.id)!;
    await caller(owner).business.action({
      boardId,
      id: r.id,
      version: r.version,
      action: "settle",
    });
    await expect(
      caller(owner).business.action({
        boardId,
        id: r.id,
        version: r.version,
        action: "settle",
      })
    ).rejects.toThrow();
    const e = await add("expense", { amount: 50, payerUserId: owner.id });
    r = (await rows()).find(r => r.id === e.id)!;
    expect(businessTotals(await rows()).available).toBe(750);
    await caller(owner).business.action({
      boardId,
      id: r.id,
      version: r.version,
      action: "reimburse",
    });
    expect(businessTotals(await rows())).toMatchObject({
      balance: 750,
      available: 750,
      reimbursements: 0,
    });
    await expect(
      add("obligation", { amount: 20, status: "مدفوع" })
    ).rejects.toThrow();
  });
  it("creates the next recurring task once and preserves archived records", async () => {
    const t = await add("task", {
      recurrence: "monthly",
      dueDate: "2026-01-31",
    });
    const r = (await rows()).find(r => r.id === t.id)!;
    await caller(owner).business.save({
      ...r,
      boardId,
      data: { ...r.data, status: "مكتملة" },
    });
    await expect(
      caller(owner).business.save({
        ...r,
        boardId,
        data: { ...r.data, status: "مكتملة" },
      })
    ).rejects.toThrow();
    expect(
      (await rows()).filter(
        r => r.kind === "task" && r.data.dueDate === "2026-02-28"
      )
    ).toHaveLength(1);
    let completed = (await rows()).find(r => r.id === t.id)!;
    await caller(owner).business.save({
      ...completed,
      boardId,
      data: { ...completed.data, status: "قادمة" },
    });
    completed = (await rows()).find(r => r.id === t.id)!;
    await caller(owner).business.save({
      ...completed,
      boardId,
      data: { ...completed.data, status: "مكتملة" },
    });
    expect(
      (await rows()).filter(
        r => r.kind === "task" && r.data.dueDate === "2026-02-28"
      )
    ).toHaveLength(1);
    const updated = (await rows()).find(r => r.id === t.id)!;
    await caller(owner).business.action({
      boardId,
      id: t.id,
      version: updated.version,
      action: "archive",
    });
    const archived = (await rows()).find(r => r.id === t.id)!;
    expect(archived.archived).toBe(true);
    await caller(owner).business.action({
      boardId,
      id: t.id,
      version: archived.version,
      action: "restore",
    });
    expect((await rows()).find(r => r.id === t.id)?.archived).toBe(false);
  });
  it("shares work with another member and prevents lost updates", async () => {
    await (await getDb())!
      .insert(boardMemberships)
      .values({ boardId, userId: outsider.id, role: "member" });
    const created = await caller(outsider).business.save({
      boardId,
      kind: "idea",
      data: businessData.parse({
        title: "فكرة مشتركة",
        assigneeUserId: outsider.id,
      }),
    });
    const original = (await rows()).find(r => r.id === created.id)!;
    await caller(owner).business.save({
      ...original,
      boardId,
      data: { ...original.data, nextStep: "اختبار الطلب" },
    });
    await expect(
      caller(outsider).business.save({
        ...original,
        boardId,
        data: { ...original.data, title: "تعديل متزامن" },
      })
    ).rejects.toThrow();
    const shared = await caller(outsider).business.overview({ boardId });
    expect(shared.records.find(r => r.id === created.id)?.data.nextStep).toBe(
      "اختبار الطلب"
    );
  });
  it("keeps uploaded files behind board membership and limits types", async () => {
    const f = await caller(owner).business.upload({
      boardId,
      name: "notes.txt",
      mime: "text/plain",
      body: Buffer.from("local test").toString("base64"),
    });
    expect(
      (await caller(owner).business.download({ boardId, id: f.id })).name
    ).toBe("notes.txt");
    await expect(
      caller(viewer).business.download({ boardId: otherBoardId, id: f.id })
    ).rejects.toThrow();
    await expect(
      caller(owner).business.download({ boardId: otherBoardId, id: f.id })
    ).rejects.toThrow();
    await expect(
      caller(viewer).business.upload({
        boardId,
        name: "x.txt",
        mime: "text/plain",
        body: "dGVzdA==",
      })
    ).rejects.toThrow();
    await expect(
      caller(owner).business.upload({
        boardId,
        name: "x.html",
        mime: "text/html",
        body: "dGVzdA==",
      })
    ).rejects.toThrow();
  });
  it("assistant drafts save tasks atomically and only once in the new template", async () => {
    const context = await boardContext(boardId, owner.id);
    expect(context.template).toBe("business");
    const a = assistantAction.parse({
      taskId: null,
      version: null,
      title: "مهمة من المساعد",
      sectionId: null,
      assigneeUserId: owner.id,
      dueDate: null,
    });
    const id = nanoid(32);
    await (await getDb())!.insert(assistantDrafts).values({
      id,
      boardId,
      userId: owner.id,
      actions: [a],
      expiresAt: new Date(Date.now() + 600000),
    });
    await caller(owner).assistant.acceptDraft({
      boardId,
      draftId: id,
      actions: [a],
    });
    await caller(owner).assistant.acceptDraft({
      boardId,
      draftId: id,
      actions: [a],
    });
    expect((await rows()).filter(r => r.data.title === a.title)).toHaveLength(
      1
    );
  });
});
