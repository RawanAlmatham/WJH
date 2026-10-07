import { beforeEach, describe, expect, it, vi } from "vitest";
import { consultationFieldsSchema } from "../shared/consultations";
import {
  consultationToTask,
  saveConsultation,
  deleteConsultation,
} from "./consultations";

const m = vi.hoisted(() => ({
  rows: vi.fn(),
  write: vi.fn(),
  values: vi.fn(),
  insert: vi.fn(),
  set: vi.fn(),
  transaction: vi.fn(),
  where: vi.fn(),
}));
vi.mock("./db", () => ({
  getDb: async () => {
    const db = {
      select: () => ({ from: () => ({ where: m.where }) }),
      insert: m.insert,
      update: () => ({ set: m.set }),
      delete: () => ({ where: m.write }),
      transaction: m.transaction,
    };
    m.transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback(db)
    );
    return db;
  },
}));
const fields = {
  title: "مراجعة الفكرة",
  consultant: "مستشار أعمال",
  goal: "اختبار النموذج",
  status: "preparing" as const,
  questions: [
    {
      id: "q2",
      text: "كيف نختبر السعر؟",
      priority: "high" as const,
      answer: "اختبار مع خمسة عملاء",
    },
    { id: "q1", text: "من العميل؟", priority: "normal" as const, answer: "" },
  ],
  summary: "خلاصة",
  recommendations: "اختبار السعر",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.rows.mockResolvedValue([{ id: 3 }]);
  m.where.mockReturnValue({
    limit: () => {
      const result = m.rows();
      result.for = () => result;
      return result;
    },
  });
  m.write.mockResolvedValue([{ affectedRows: 1 }]);
  m.set.mockReturnValue({ where: m.write });
  m.values.mockResolvedValue([{ insertId: 12 }]);
  m.insert.mockReturnValue({ values: m.values });
});
describe("idea consultations", () => {
  it("preserves manual question order and answers without AI", async () => {
    await saveConsultation({ ...fields, boardId: 2, ideaId: 3, userId: 4 });
    expect(m.values).toHaveBeenCalledWith(
      expect.objectContaining({
        questions: fields.questions,
        createdByUserId: 4,
        boardId: 2,
        ideaId: 3,
      })
    );
  });
  it("refuses saving against an idea outside the current board", async () => {
    m.rows.mockResolvedValue([]);
    await expect(
      saveConsultation({ ...fields, boardId: 2, ideaId: 3, userId: 4 })
    ).rejects.toThrow("في هذه اللوحة");
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("rejects stale saves without overwriting a teammate's changes", async () => {
    m.write.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(
      saveConsultation({
        ...fields,
        boardId: 2,
        ideaId: 3,
        userId: 4,
        id: 5,
        version: 1,
      })
    ).rejects.toThrow("تغيرت الاستشارة");
  });
  it("rejects duplicate question IDs", () => {
    expect(
      consultationFieldsSchema.safeParse({
        ...fields,
        questions: [fields.questions[0], fields.questions[0]],
      }).success
    ).toBe(false);
  });
  it("returns an existing follow-up task instead of making a duplicate", async () => {
    m.rows.mockResolvedValue([{ id: 5, taskId: 11 }]);
    await expect(consultationToTask(2, 5, 4)).resolves.toEqual({ id: 11 });
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("creates a task in the same idea from saved recommendations", async () => {
    m.rows.mockResolvedValue([
      {
        id: 5,
        ideaId: 3,
        title: fields.title,
        recommendations: fields.recommendations,
        taskId: null,
      },
    ]);
    await expect(consultationToTask(2, 5, 4)).resolves.toEqual({ id: 12 });
    expect(m.values).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: 2,
        ideaId: 3,
        description: fields.recommendations,
        assigneeUserId: 4,
      })
    );
    expect(m.set).toHaveBeenCalledWith({ taskId: 12 });
  });
  it("rejects converting an inaccessible consultation", async () => {
    m.rows.mockResolvedValue([]);
    await expect(consultationToTask(2, 5, 4)).rejects.toThrow("في هذه اللوحة");
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("rejects deletion outside the current board", async () => {
    m.write.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(deleteConsultation(2, 5)).rejects.toThrow("في هذه اللوحة");
  });
});
