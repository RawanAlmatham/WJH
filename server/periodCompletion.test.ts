import { describe, expect, it } from "vitest";
import {
  calculatePeriodCompletion,
  getCompletionPeriodRange,
} from "../shared/periodCompletion";

describe("period completion", () => {
  const referenceDate = new Date(2026, 8, 9, 12);

  it("uses Sunday through Saturday for the weekly range", () => {
    const range = getCompletionPeriodRange("week", referenceDate);

    expect(range.start).toEqual(new Date(2026, 8, 6));
    expect(range.end).toEqual(new Date(2026, 8, 13));
  });

  it("counts only tasks due in the selected week", () => {
    const result = calculatePeriodCompletion(
      [
        { status: "complete", dueDate: "2026-09-06" },
        { status: "complete", dueDate: "2026-09-10" },
        { status: "in_progress", dueDate: "2026-09-12" },
        { status: "complete", dueDate: "2026-09-05" },
        { status: "not_started", dueDate: "2026-09-13" },
        { status: "not_started", dueDate: null },
      ],
      "week",
      referenceDate
    );

    expect(result.completed).toBe(2);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(67);
  });

  it("returns zero when no tasks have a due date in the period", () => {
    const result = calculatePeriodCompletion(
      [
        { status: "complete", dueDate: null },
        { status: "complete", dueDate: "not-a-date" },
        { status: "complete", dueDate: "2027-01-01" },
      ],
      "month",
      referenceDate
    );

    expect(result).toMatchObject({ completed: 0, total: 0, percentage: 0 });
  });

  it.each([
    ["day", "2026-09-09", "2026-09-10"],
    ["month", "2026-09-01", "2026-10-01"],
    ["quarter", "2026-07-01", "2026-10-01"],
    ["year", "2026-01-01", "2027-01-01"],
  ] as const)(
    "calculates the %s range",
    (period, expectedStart, expectedEnd) => {
      const range = getCompletionPeriodRange(period, referenceDate);

      expect(range.start).toEqual(new Date(`${expectedStart}T00:00:00`));
      expect(range.end).toEqual(new Date(`${expectedEnd}T00:00:00`));
    }
  );
});
