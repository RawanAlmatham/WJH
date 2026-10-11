import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, createManagementBoard, selectManagementBoard } from "./db";
import {
  users,
  boardMemberships,
  assistantDrafts,
  personalLifeTasks,
  ideaLabIdeas,
  ideaLabTasks,
  teamMembers,
  tasks,
  projects,
} from "../drizzle/schema";
import {
  boardContext,
  ideaAction,
  workAction,
  validateBoardActions,
} from "./assistantBoard";
import * as assistant from "./assistant";
import { assistantAction, type AssistantAction } from "../shared/assistant";
import { appRouter } from "./routers";

describe.skipIf(
  process.env.COMMERCE_INTEGRATION_TEST !== "1" ||
    !process.env.DATABASE_URL?.endsWith("/wjh_commerce_test")
)("assistant across templates", () => {
  let owner: typeof users.$inferSelect, other: typeof users.$inferSelect;
  const boards: Record<string, number> = {};
  const caller = (user: typeof users.$inferSelect) =>
    appRouter.createCaller({
      user,
      req: { headers: {} } as any,
      res: {} as any,
    });
  async function draft(boardId: number, actions: AssistantAction[]) {
    const id = nanoid(32);
    await (await getDb())!
      .insert(assistantDrafts)
      .values({
        id,
        boardId,
        userId: owner.id,
        actions,
        expiresAt: new Date(Date.now() + 600000),
      });
    return id;
  }
  beforeAll(async () => {
    const db = (await getDb())!,
      accounts = [];
    for (const name of ["مستخدم المساعد", "مستخدم آخر"]) {
      const id = Number(
        (await db.insert(users).values({ openId: nanoid(), name }))[0].insertId
      );
      accounts.push((await db.select().from(users).where(eq(users.id, id)))[0]);
    }
    [owner, other] = accounts;
    for (const template of ["personal", "idea_lab", "work"])
      boards[template] = (
        await createManagementBoard(
          "اختبار " + template,
          owner.id,
          template,
          false
        )
      ).id;
    await db
      .insert(boardMemberships)
      .values({ boardId: boards.personal, userId: other.id, role: "member" });
    await assistant.saveSettings(
      owner.id,
      "gsk_" + "not-real-local-test-key".repeat(2)
    );
  });
  afterEach(() => vi.restoreAllMocks());
  it("personal chat saves execution and daily focus once without exposing another user's tasks", async () => {
    const boardId = boards.personal,
      db = (await getDb())!;
    await db
      .insert(personalLifeTasks)
      .values({ boardId, userId: other.id, title: "PRIVATE_OTHER_USER_TASK" });
    const context = await boardContext(boardId, owner.id);
    const a = assistantAction.parse({
      title: "مشي",
      sectionId: context.sections[0].id,
      assigneeUserId: owner.id,
      taskId: null,
      version: null,
      dueDate: "2026-10-15",
      executionDate: "2026-10-12",
      executionTime: "18:00",
      focusDate: "2026-10-11",
    });
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    reply: "اقتراح للمراجعة",
                    actions: [a],
                  }),
                },
              },
            ],
          })
        )
      );
    await selectManagementBoard(owner.id, boardId);
    const result = await caller(owner).assistant.chat({
      boardId,
      message: "أضف مشي",
      history: [],
    });
    expect(String(mock.mock.calls[0][1]?.body)).not.toContain(
      "PRIVATE_OTHER_USER_TASK"
    );
    expect((await boardContext(boardId, owner.id)).tasks).toHaveLength(0);
    await caller(owner).assistant.acceptDraft({
      boardId,
      draftId: result.draftId!,
      actions: result.actions,
    });
    const saved = (await boardContext(boardId, owner.id)).tasks[0];
    expect(saved).toMatchObject({
      title: "مشي",
      executionTime: "18:00",
      focusDate: "2026-10-11",
      status: "todo",
    });
    expect(
      (
        await caller(owner).assistant.acceptDraft({
          boardId,
          draftId: result.draftId!,
          actions: result.actions,
        })
      ).alreadyApplied
    ).toBe(true);
    const foreign = (
      await db
        .select()
        .from(personalLifeTasks)
        .where(eq(personalLifeTasks.userId, other.id))
    )[0];
    const tampered = { ...a, taskId: foreign.id, version: foreign.version };
    await expect(
      assistant.applyDraft(
        boardId,
        owner.id,
        await draft(boardId, [tampered]),
        [tampered]
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db
      .update(personalLifeTasks)
      .set({ title: "تعديل أحدث", version: saved.version! + 1 })
      .where(eq(personalLifeTasks.id, saved.taskId!));
    const next = { ...a, title: "لا تحفظ" };
    await expect(
      assistant.applyDraft(
        boardId,
        owner.id,
        await draft(boardId, [next, saved]),
        [next, saved]
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await boardContext(boardId, owner.id)).tasks).toHaveLength(1);
    expect(() =>
      validateBoardActions([{ ...next, description: "unsupported" }], context)
    ).toThrow();
    expect(() =>
      validateBoardActions(
        [{ ...next, executionDate: null, executionTime: "12:00" }],
        context
      )
    ).toThrow();
  });
  it("idea proposals preserve priority, links and the existing due time, and reject stale content", async () => {
    const boardId = boards.idea_lab,
      db = (await getDb())!;
    const ideaId = Number(
      (
        await db
          .insert(ideaLabIdeas)
          .values({ boardId, title: "فكرة عامة", createdByUserId: owner.id })
      )[0].insertId
    );
    const a = assistantAction.parse({
      title: "اختبار الفكرة",
      sectionId: ideaId,
      priority: "high",
      assigneeUserId: owner.id,
      dueDate: "2026-10-15",
      taskId: null,
      version: null,
    });
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ reply: "اقتراح", actions: [a] }),
                },
              },
            ],
          })
        )
      );
    await selectManagementBoard(owner.id, boardId);
    const result = await caller(owner).assistant.chat({
      boardId,
      message: "أضف مهمة",
      history: [],
    });
    expect(String(mock.mock.calls[0][1]?.body)).toContain("idea_lab");
    await caller(owner).assistant.acceptDraft({
      boardId,
      draftId: result.draftId!,
      actions: result.actions,
    });
    let row = (
      await db
        .select()
        .from(ideaLabTasks)
        .where(eq(ideaLabTasks.boardId, boardId))
    )[0];
    const originalDate = new Date("2026-10-15T18:30:00Z");
    await db
      .update(ideaLabTasks)
      .set({ dueDate: originalDate })
      .where(eq(ideaLabTasks.id, row.id));
    row = (
      await db.select().from(ideaLabTasks).where(eq(ideaLabTasks.id, row.id))
    )[0];
    const edit = {
      ...ideaAction(row),
      title: "تعديل الاسم",
      status: "done" as const,
    };
    await assistant.applyDraft(
      boardId,
      owner.id,
      await draft(boardId, [edit]),
      [edit]
    );
    const saved = (
      await db.select().from(ideaLabTasks).where(eq(ideaLabTasks.id, row.id))
    )[0];
    expect(saved).toMatchObject({ ideaId, priority: "high", status: "done" });
    expect(saved.dueDate?.getTime()).toBe(originalDate.getTime());
    expect(saved.completedAt).toBeInstanceOf(Date);
    const latest = ideaAction(saved);
    await db
      .update(ideaLabTasks)
      .set({ description: "تغيير في نفس الثانية" })
      .where(eq(ideaLabTasks.id, row.id));
    await expect(
      assistant.applyDraft(boardId, owner.id, await draft(boardId, [latest]), [
        latest,
      ])
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("work proposals save native statuses and obey project restrictions", async () => {
    const boardId = boards.work,
      db = (await getDb())!;
    const memberId = (
      await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.boardId, boardId),
            eq(teamMembers.userId, owner.id)
          )
        )
    )[0].id;
    const projectId = Number(
      (
        await db
          .insert(projects)
          .values({
            boardId,
            title: "مشروع عام",
            ownerMemberId: memberId,
            startDate: new Date(),
          })
      )[0].insertId
    );
    const a = assistantAction.parse({
      title: "مهمة عمل",
      sectionId: projectId,
      priority: "medium",
      status: "in_review",
      assigneeUserId: memberId,
      dueDate: null,
      taskId: null,
      version: null,
    });
    await assistant.applyDraft(boardId, owner.id, await draft(boardId, [a]), [
      a,
    ]);
    const context = await boardContext(boardId, owner.id);
    const row = (
      await db.select().from(tasks).where(eq(tasks.boardId, boardId))
    )[0];
    expect(context.tasks[0].version).toBe(workAction(row).version);
    const edit = { ...context.tasks[0], status: "done" as const };
    await assistant.applyDraft(
      boardId,
      owner.id,
      await draft(boardId, [edit]),
      [edit]
    );
    expect(
      (await db.select().from(tasks).where(eq(tasks.id, row.id)))[0].status
    ).toBe("complete");
    expect(
      (await db.select().from(projects).where(eq(projects.id, projectId)))[0]
        .progress
    ).toBe(100);
    await db
      .update(boardMemberships)
      .set({ role: "member" })
      .where(
        and(
          eq(boardMemberships.boardId, boardId),
          eq(boardMemberships.userId, owner.id)
        )
      );
    await db
      .update(teamMembers)
      .set({ projectAccess: "selected", allowedProjectIds: [] })
      .where(eq(teamMembers.id, memberId));
    expect((await boardContext(boardId, owner.id)).tasks).toHaveLength(0);
    await expect(
      assistant.applyDraft(boardId, owner.id, await draft(boardId, [a]), [a])
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("voice works outside commerce, and viewer writes and wrong-board context are rejected", async () => {
    const boardId = boards.idea_lab;
    const audio = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(16),
    ]).toString("base64");
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ text: "أضف مهمة مقابلة" }))
      );
    await selectManagementBoard(owner.id, boardId);
    expect(
      await caller(owner).assistant.transcribe({
        boardId,
        audio,
        format: "webm",
      })
    ).toEqual({ text: "أضف مهمة مقابلة" });
    expect(String(mock.mock.calls[0][0])).toContain("audio/transcriptions");
    await (await getDb())!
      .update(boardMemberships)
      .set({ role: "viewer" })
      .where(
        and(
          eq(boardMemberships.boardId, boardId),
          eq(boardMemberships.userId, owner.id)
        )
      );
    const a = (await boardContext(boardId, owner.id)).tasks[0];
    await expect(
      caller(owner).assistant.acceptDraft({
        boardId,
        draftId: await draft(boardId, [a]),
        actions: [a],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(owner).assistant.context({ boardId: boards.personal })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
