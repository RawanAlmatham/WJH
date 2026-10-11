import { describe, it, expect } from "vitest";
import {
  personalTaskFields,
  personalToday,
  suggestPersonalTasks,
} from "../shared/personal";
describe("personal daily priorities", () => {
  it("orders overdue and closest deadlines, skips completed, undated and already chosen tasks", () => {
    const task = (
      id: number,
      dueDate: string | null,
      done = false,
      focusDate: string | null = null
    ) => ({ id, dueDate, done, focusDate });
    expect(
      suggestPersonalTasks(
        [
          task(1, "2026-10-15"),
          task(2, "2026-10-09"),
          task(3, "2026-10-11"),
          task(4, "2026-10-12"),
          task(5, null),
          task(6, "2026-10-08", true),
          task(7, "2026-10-07", false, "2026-10-11"),
        ],
        "2026-10-11"
      ).map(t => t.id)
    ).toEqual([2, 3, 4]);
  });
  it("allows a previous day selection to be suggested again without modifying its deadline", () => {
    const task = {
      id: 1,
      dueDate: "2026-10-12",
      done: false,
      focusDate: "2026-10-10",
    };
    expect(suggestPersonalTasks([task], "2026-10-11")).toEqual([task]);
    expect(task.dueDate).toBe("2026-10-12");
  });
  it("uses Riyadh day across UTC midnight and validates calendar dates and execution time", () => {
    expect(personalToday(new Date("2026-10-10T22:00:00Z"))).toBe("2026-10-11");
    const base = {
      title: "مهمة",
      categoryId: null,
      dueDate: null,
      executionDate: null,
      executionTime: null,
    };
    expect(
      personalTaskFields.safeParse({ ...base, dueDate: "2026-02-30" }).success
    ).toBe(false);
    expect(
      personalTaskFields.safeParse({ ...base, executionTime: "18:00" }).success
    ).toBe(false);
    expect(
      personalTaskFields.safeParse({
        ...base,
        executionDate: "2026-10-11",
        executionTime: "18:00",
      }).success
    ).toBe(true);
  });
});
