import { beforeAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, createManagementBoard, selectManagementBoard } from "./db";
import { users, boardMemberships } from "../drizzle/schema";
import { appRouter } from "./routers";
import { personalToday } from "../shared/personal";
describe.skipIf(
  process.env.COMMERCE_INTEGRATION_TEST !== "1" ||
    !process.env.DATABASE_URL?.endsWith("/wjh_commerce_test")
)("personal persistence and isolation", () => {
  let owner: typeof users.$inferSelect,
    member: typeof users.$inferSelect,
    viewer: typeof users.$inferSelect;
  let boardId: number;
  const caller = (user: typeof users.$inferSelect) =>
    appRouter.createCaller({
      user,
      req: { headers: {} } as any,
      res: {} as any,
    });
  beforeAll(async () => {
    const db = (await getDb())!;
    const accounts = [];
    for (const role of ["owner", "member", "viewer"]) {
      const result = await db
        .insert(users)
        .values({ openId: `personal-${Date.now()}-${role}`, name: role });
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
    boardId = (await createManagementBoard("شخصية", owner.id, "personal")).id;
    for (const [user, role] of [
      [member, "member"],
      [viewer, "viewer"],
    ] as const) {
      await db
        .insert(boardMemberships)
        .values({ boardId, userId: user.id, role });
      await selectManagementBoard(user.id, boardId);
    }
  });
  it("initializes categories once and starts with an empty list", async () => {
    const [a, b] = await Promise.all([
      caller(owner).personal.overview(),
      caller(owner).personal.overview(),
    ]);
    expect(a.categories).toHaveLength(5);
    expect(b.categories).toHaveLength(5);
    expect(a.tasks).toHaveLength(0);
  });
  it("persists creation, edits, selection and completion, preserving the deadline", async () => {
    const client = caller(owner);
    const overview = await client.personal.overview();
    await client.personal.saveTask({
      title: "الفحص",
      categoryId: overview.categories[0].id,
      dueDate: "2026-10-12",
      executionDate: "2026-10-11",
      executionTime: "18:00",
    });
    let task = (await client.personal.overview()).tasks[0];
    await client.personal.setState({
      id: task.id,
      version: task.version,
      focus: true,
    });
    task = (await client.personal.overview()).tasks[0];
    expect(task.focusDate).toBe(personalToday());
    expect(task.dueDate).toBe("2026-10-12");
    await client.personal.setState({
      id: task.id,
      version: task.version,
      done: true,
    });
    await expect(
      client.personal.setState({
        id: task.id,
        version: task.version,
        focus: false,
      })
    ).rejects.toThrow();
    task = (await client.personal.overview()).tasks[0];
    expect(task.done).toBe(true);
    await client.personal.setState({
      id: task.id,
      version: task.version,
      focus: false,
    });
    task = (await client.personal.overview()).tasks[0];
    expect(task.focusDate).toBeNull();
    expect(task.dueDate).toBe("2026-10-12");
  });
  it("isolates member tasks, blocks foreign categories and task updates and prevents viewer writes", async () => {
    const own = await caller(owner).personal.overview();
    const other = await caller(member).personal.overview();
    expect(other.tasks).toHaveLength(0);
    await expect(
      caller(member).personal.saveTask({
        title: "اختبار",
        categoryId: own.categories[0].id,
        dueDate: null,
        executionDate: null,
        executionTime: null,
      })
    ).rejects.toThrow();
    await expect(
      caller(member).personal.setState({
        id: own.tasks[0].id,
        version: own.tasks[0].version,
        done: false,
      })
    ).rejects.toThrow();
    await expect(
      caller(viewer).personal.saveCategory({ name: "تصنيف" })
    ).rejects.toThrow();
    await caller(owner).personal.saveCategory({
      id: own.categories[0].id,
      name: "العائلة",
    });
    expect((await caller(owner).personal.overview()).categories[0].name).toBe(
      "العائلة"
    );
  });
});
