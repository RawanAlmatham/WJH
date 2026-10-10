import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, createManagementBoard, selectManagementBoard } from "./db";
import { appRouter } from "./routers";
import { users, boardMemberships, teamMembers } from "../drizzle/schema";
import * as commerce from "./commerce";
import { commerceTaskFields } from "../shared/commerce";

// Opt in only against the disposable local commerce database; never use production.
describe.skipIf(
  process.env.COMMERCE_INTEGRATION_TEST !== "1" ||
    !process.env.DATABASE_URL?.endsWith("/wjh_commerce_test")
)("persistent commerce project", () => {
  let owner: typeof users.$inferSelect;
  let member: typeof users.$inferSelect;
  let viewer: typeof users.$inferSelect;
  let board: Awaited<ReturnType<typeof createManagementBoard>>;
  let other: Awaited<ReturnType<typeof createManagementBoard>>;
  let taskId = 0;
  let sectionId = 0;
  const caller = (user: typeof users.$inferSelect) =>
    appRouter.createCaller({
      user,
      req: { headers: {} } as any,
      res: {} as any,
    });
  beforeAll(async () => {
    const db = (await getDb())!;
    const marker = `commerce-${Date.now()}`;
    const accounts = [];
    for (const role of ["owner", "member", "viewer"]) {
      const result = await db
        .insert(users)
        .values({
          openId: `${marker}-${role}`,
          name: role,
          email: `${marker}-${role}@example.test`,
        });
      accounts.push(
        (
          await db
            .select()
            .from(users)
            .where(eq(users.id, Number(result[0].insertId)))
        )[0]
      );
    }
    [owner, member, viewer] = accounts;
    board = await createManagementBoard(
      "مشروع اختبار",
      owner.id,
      "commerce_import",
      true
    );
    other = await createManagementBoard(
      "مشروع فارغ",
      owner.id,
      "commerce_import",
      false
    );
    await selectManagementBoard(owner.id, board.id);
    for (const [account, role] of [
      [member, "member"],
      [viewer, "viewer"],
    ] as const) {
      await db
        .insert(boardMemberships)
        .values({ boardId: board.id, userId: account.id, role });
      await db
        .insert(teamMembers)
        .values({
          boardId: board.id,
          userId: account.id,
          name: account.name!,
          role,
          avatarInitials: role.slice(0, 2),
        });
      await selectManagementBoard(account.id, board.id);
    }
    sectionId = (await commerce.overview(board.id)).sections[0].id;
  });
  it("creates six sections, optionally seeds tasks, and scopes the overview", async () => {
    const first = await caller(owner).commerce.overview();
    expect(first.sections).toHaveLength(6);
    expect(first.tasks).toHaveLength(12);
    expect(first.tasks.every(t => t.assigneeUserId === owner.id)).toBe(true);
    const blank = await commerce.overview(other.id);
    expect(blank.sections).toHaveLength(6);
    expect(blank.tasks).toHaveLength(0);
  });
  it("persists tasks, checklist, waiting reason, assignee and moving between sections", async () => {
    const sections = (await commerce.overview(board.id)).sections;
    const fields = commerceTaskFields.parse({
      title: "طلب العينة",
      sectionId,
      assigneeUserId: member.id,
      dueDate: "2026-10-12",
      status: "blocked",
      waitingReason: "المورد",
      checklist: [{ id: "spec", text: "تأكيد المواصفات", done: true }],
    });
    const result = await caller(member).commerce.saveTask(fields);
    taskId = result.id;
    const task = (await commerce.overview(board.id)).tasks.find(
      t => t.id === taskId
    )!;
    expect(task.waitingReason).toBe("المورد");
    expect(task.checklist?.[0].done).toBe(true);
    await caller(member).commerce.saveTask({
      ...fields,
      id: taskId,
      version: task.version,
      sectionId: sections[1].id,
    });
    expect(
      (await commerce.overview(board.id)).tasks.find(t => t.id === taskId)
        ?.sectionId
    ).toBe(sections[1].id);
  });
  it("rejects stale saves and references from another board", async () => {
    const otherSection = (await commerce.overview(other.id)).sections[0].id;
    const fields = commerceTaskFields.parse({
      title: "متابعة",
      sectionId,
      assigneeUserId: member.id,
      dueDate: null,
    });
    await expect(
      caller(member).commerce.saveTask({ ...fields, id: taskId, version: 1 })
    ).rejects.toThrow("عدّل أحد أعضاء الفريق");
    await expect(
      caller(member).commerce.saveTask({ ...fields, sectionId: otherSection })
    ).rejects.toThrow("هذه اللوحة");
    await expect(
      caller(member).commerce.saveTask({ ...fields, assigneeUserId: 99999999 })
    ).rejects.toThrow("أعضاء هذه اللوحة");
  });
  it("allows members to work on tasks but denies section management and viewer writes", async () => {
    await expect(
      caller(member).commerce.saveSection({ name: "غير مسموح" })
    ).rejects.toThrow("مدير اللوحة");
    await expect(
      caller(viewer).commerce.archiveTask({ id: taskId, archived: true })
    ).rejects.toThrow("عضوًا");
    expect(
      (await caller(viewer).commerce.overview()).tasks.length
    ).toBeGreaterThan(0);
  });
  it("archives and restores a section without dropping its tasks", async () => {
    const original = await commerce.overview(board.id);
    const section = original.sections[1];
    await caller(owner).commerce.archiveSection({
      id: section.id,
      archived: true,
    });
    expect((await commerce.overview(board.id)).tasks).toEqual(original.tasks);
    await expect(
      caller(member).commerce.saveTask(
        commerceTaskFields.parse({
          title: "جديدة",
          sectionId: section.id,
          assigneeUserId: null,
          dueDate: null,
        })
      )
    ).rejects.toThrow("استعد القسم");
    await caller(owner).commerce.archiveSection({
      id: section.id,
      archived: false,
    });
    expect(
      (await commerce.overview(board.id)).sections.find(
        s => s.id === section.id
      )?.archived
    ).toBe(false);
  });
  it("persists section ordering, task archiving and resource links", async () => {
    await caller(owner).commerce.moveSection({
      id: sectionId,
      direction: "down",
    });
    expect((await commerce.overview(board.id)).sections[1].id).toBe(sectionId);
    await caller(member).commerce.archiveTask({ id: taskId, archived: true });
    expect(
      (await commerce.overview(board.id)).tasks.find(t => t.id === taskId)
        ?.archived
    ).toBe(true);
    await caller(member).commerce.archiveTask({ id: taskId, archived: false });
    await caller(member).commerce.saveResource({
      title: "عرض سعر",
      url: "https://example.test/quote.pdf",
      notes: "العرض الأول",
    });
    const resource = (await commerce.overview(board.id)).resources[0];
    await caller(member).commerce.archiveResource({
      id: resource.id,
      archived: true,
    });
    expect((await commerce.overview(board.id)).resources[0].archived).toBe(
      true
    );
    expect((await commerce.overview(other.id)).resources).toHaveLength(0);
  });
});
