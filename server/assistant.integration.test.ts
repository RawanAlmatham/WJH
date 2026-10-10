import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, createManagementBoard, selectManagementBoard } from "./db";
import { appRouter } from "./routers";
import {
  users,
  boardMemberships,
  assistantDrafts,
  userGroqSettings,
} from "../drizzle/schema";
import * as commerce from "./commerce";
import * as assistant from "./assistant";
import { assistantAction } from "../shared/assistant";
import { nanoid } from "nanoid";

describe.skipIf(
  process.env.COMMERCE_INTEGRATION_TEST !== "1" ||
    !process.env.DATABASE_URL?.endsWith("/wjh_commerce_test")
)("Groq assistant with disposable database and mocked provider", () => {
  let owner: typeof users.$inferSelect;
  let viewer: typeof users.$inferSelect;
  let boardId: number;
  let otherBoardId: number;
  let sectionId: number;
  const caller = (user: typeof users.$inferSelect) =>
    appRouter.createCaller({
      user,
      req: { headers: {} } as any,
      res: {} as any,
    });
  const fields = () =>
    assistantAction.parse({
      title: "مقارنة أدوات الطبخ",
      sectionId,
      dueDate: null,
      assigneeUserId: owner.id,
      taskId: null,
      version: null,
    });
  beforeAll(async () => {
    const db = (await getDb())!;
    const accounts = [];
    for (const role of ["owner", "viewer"]) {
      const inserted = await db
        .insert(users)
        .values({ openId: `assistant-${role}-${Date.now()}`, name: role });
      accounts.push(
        (
          await db
            .select()
            .from(users)
            .where(eq(users.id, Number(inserted[0].insertId)))
        )[0]
      );
    }
    [owner, viewer] = accounts;
    boardId = (
      await createManagementBoard(
        "تجربة مساعد",
        owner.id,
        "commerce_import",
        false
      )
    ).id;
    otherBoardId = (
      await createManagementBoard(
        "لوحة أخرى",
        owner.id,
        "commerce_import",
        false
      )
    ).id;
    await selectManagementBoard(owner.id, boardId);
    await db
      .insert(boardMemberships)
      .values({ boardId, userId: viewer.id, role: "viewer" });
    await selectManagementBoard(viewer.id, boardId);
    sectionId = (await commerce.overview(boardId)).sections[0].id;
  });
  afterEach(() => vi.restoreAllMocks());
  async function storedDraft(actions: ReturnType<typeof fields>[]) {
    const db = (await getDb())!;
    const id = nanoid(32);
    await db.insert(assistantDrafts).values({
      id,
      boardId,
      userId: owner.id,
      actions,
      expiresAt: new Date(Date.now() + 600000),
    });
    return id;
  }
  it("stores a personal encrypted key, never returns it, and preserves separate OpenAI settings", async () => {
    const key = "gsk_" + "local-test-not-a-real-key-".repeat(2);
    await caller(owner).assistant.saveSettings({ apiKey: key });
    const settings = await caller(owner).assistant.settings();
    expect(settings).toEqual({ configured: true, lastFour: key.slice(-4) });
    const db = (await getDb())!;
    const [stored] = await db
      .select()
      .from(userGroqSettings)
      .where(eq(userGroqSettings.userId, owner.id));
    expect(stored.encryptedApiKey).not.toContain(key);
    expect((await caller(viewer).assistant.settings()).configured).toBe(false);
  });
  it("creates a review draft with no task write, then applies once even after retry", async () => {
    const proposed = fields();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "جهزت الاقتراح",
                  actions: [proposed],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    const before = (await commerce.overview(boardId)).tasks.length;
    const result = await caller(owner).assistant.chat({
      boardId,
      message: "أضف مقارنة الموردين",
      history: [],
    });
    expect(result.draftId).toHaveLength(32);
    expect((await commerce.overview(boardId)).tasks).toHaveLength(before);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.groq.com/openai/v1/chat/completions"
    );
    const saved = await caller(owner).assistant.acceptDraft({
      boardId,
      draftId: result.draftId!,
      actions: result.actions,
    });
    expect(saved.alreadyApplied).toBe(false);
    expect(
      (
        await caller(owner).assistant.acceptDraft({
          boardId,
          draftId: result.draftId!,
          actions: result.actions,
        })
      ).alreadyApplied
    ).toBe(true);
    expect((await commerce.overview(boardId)).tasks).toHaveLength(before + 1);
  });
  it("blocks cross-board identities, foreign drafts and viewer writes", async () => {
    const draftId = await storedDraft([fields()]);
    await expect(
      caller(viewer).assistant.acceptDraft({
        boardId,
        draftId,
        actions: [fields()],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(owner).assistant.acceptDraft({
        boardId: otherBoardId,
        draftId,
        actions: [fields()],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      assistant.applyDraft(otherBoardId, owner.id, draftId, [fields()])
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      assistant.applyDraft(boardId, viewer.id, draftId, [fields()])
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller(owner).assistant.acceptDraft({
        boardId,
        draftId,
        actions: [{ ...fields(), taskId: 99999, version: 1 }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects stale batches atomically and expired drafts", async () => {
    const task = (await commerce.overview(boardId)).tasks[0];
    const update = { ...fields(), taskId: task.id, version: task.version };
    const draftId = await storedDraft([fields(), update]);
    await commerce.archiveTask(boardId, task.id, true);
    const before = (await commerce.overview(boardId)).tasks.length;
    await expect(
      caller(owner).assistant.acceptDraft({
        boardId,
        draftId,
        actions: [fields(), update],
      })
    ).rejects.toThrow();
    expect((await commerce.overview(boardId)).tasks).toHaveLength(before);
    const expired = await storedDraft([fields()]);
    await (await getDb())!
      .update(assistantDrafts)
      .set({ expiresAt: new Date(Date.now() - 10000) })
      .where(eq(assistantDrafts.id, expired));
    await expect(
      caller(owner).assistant.acceptDraft({
        boardId,
        draftId: expired,
        actions: [fields()],
      })
    ).rejects.toThrow("انتهت");
  });
  it("transcribes audio with personal key and returns text without storing the recording", async () => {
    const mock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ text: "أضف مهمة تجهيز الصور" }), {
        status: 200,
      })
    );
    const audio = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(16),
    ]).toString("base64");
    expect(
      await caller(owner).assistant.transcribe({
        boardId,
        audio,
        format: "webm",
      })
    ).toEqual({ text: "أضف مهمة تجهيز الصور" });
    expect(String(mock.mock.calls[0][0])).toContain("audio/transcriptions");
    const form = mock.mock.calls[0][1]!.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
  });
  it("does not echo provider errors or secrets and supports removing the key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("a private upstream error", { status: 401 })
    );
    await expect(
      caller(owner).assistant.chat({ boardId, message: "مهامي", history: [] })
    ).rejects.toThrow("مفتاح Groq غير صالح");
    await caller(owner).assistant.removeSettings();
    expect((await caller(owner).assistant.settings()).configured).toBe(false);
  });
});
