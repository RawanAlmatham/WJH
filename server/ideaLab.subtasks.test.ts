import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createIdeaLabSubtask,
  updateIdeaLabSubtask,
  deleteIdeaLabSubtask,
} from "./ideaLab";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  values: vi.fn(),
  set: vi.fn(),
  writeWhere: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.remove,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue([{ id: 1 }]);
  mocks.values.mockResolvedValue([{ insertId: 7 }]);
  mocks.writeWhere.mockResolvedValue({});
  mocks.set.mockReturnValue({ where: mocks.writeWhere });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.remove.mockReturnValue({ where: mocks.writeWhere });
});

describe("Idea Lab subtask integrity", () => {
  it("rejects creating a step when the parent is absent from the active board", async () => {
    mocks.limit.mockResolvedValueOnce([]);
    await expect(
      createIdeaLabSubtask({ boardId: 2, taskId: 9, userId: 1, title: "خطوة" })
    ).rejects.toThrow("المهمة غير موجودة في هذه اللوحة");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects assigning a step to someone outside the active team", async () => {
    mocks.limit.mockResolvedValueOnce([{ id: 9 }]).mockResolvedValueOnce([]);
    await expect(
      createIdeaLabSubtask({
        boardId: 2,
        taskId: 9,
        userId: 1,
        title: "خطوة",
        assigneeUserId: 88,
      })
    ).rejects.toThrow("ليس عضوًا نشطًا");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("stores details and records completion when created as done", async () => {
    const result = await createIdeaLabSubtask({
      boardId: 2,
      taskId: 9,
      userId: 1,
      title: "خطوة",
      description: "التفاصيل",
      status: "done",
    });
    expect(result.id).toBe(7);
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 9,
        description: "التفاصيل",
        createdByUserId: 1,
        completedAt: expect.any(Date),
      })
    );
  });
  it("clears completion when a finished step is reopened", async () => {
    await updateIdeaLabSubtask({ boardId: 2, id: 7, status: "in_progress" });
    expect(mocks.set).toHaveBeenCalledWith({
      status: "in_progress",
      completedAt: null,
    });
  });
  it("rejects updating or deleting a step absent from the active board", async () => {
    mocks.limit.mockResolvedValue([]);
    await expect(
      updateIdeaLabSubtask({ boardId: 2, id: 7, title: "تغيير" })
    ).rejects.toThrow("في هذه اللوحة");
    await expect(deleteIdeaLabSubtask(2, 7)).rejects.toThrow("في هذه اللوحة");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
