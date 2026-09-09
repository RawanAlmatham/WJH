import { describe, expect, it } from "vitest";
import {
  getTaskAttentionReason,
  matchesTaskDueFilter,
  sortTasksByPriority,
} from "../shared/taskPriority";

describe("automatic task priority ordering", () => {
  const now = new Date("2026-09-07T12:00:00Z");

  it("orders overdue work before priority and due date", () => {
    const tasks = [
      {
        id: 1,
        status: "in_progress",
        priority: "urgent",
        dueDate: "2026-09-09",
        createdAt: "2026-09-01",
      },
      {
        id: 2,
        status: "in_progress",
        priority: "low",
        dueDate: "2026-09-06",
        createdAt: "2026-09-02",
      },
      {
        id: 3,
        status: "overdue",
        priority: "medium",
        dueDate: "2026-09-10",
        createdAt: "2026-09-03",
      },
    ];

    expect(sortTasksByPriority(tasks, now).map(task => task.id)).toEqual([
      3, 2, 1,
    ]);
  });

  it("uses priority, nearest due date, then oldest creation date", () => {
    const tasks = [
      {
        id: 1,
        status: "in_progress",
        priority: "high",
        dueDate: "2026-09-10",
        createdAt: "2026-09-03",
      },
      {
        id: 2,
        status: "in_progress",
        priority: "urgent",
        dueDate: "2026-09-12",
        createdAt: "2026-09-02",
      },
      {
        id: 3,
        status: "in_progress",
        priority: "high",
        dueDate: "2026-09-09",
        createdAt: "2026-09-04",
      },
      {
        id: 4,
        status: "in_progress",
        priority: "high",
        dueDate: "2026-09-09",
        createdAt: "2026-09-01",
      },
    ];

    expect(sortTasksByPriority(tasks, now).map(task => task.id)).toEqual([
      2, 4, 3, 1,
    ]);
  });

  it("does not mutate the input array", () => {
    const tasks = [
      { id: 1, status: "in_progress", priority: "low" },
      { id: 2, status: "in_progress", priority: "urgent" },
    ];
    sortTasksByPriority(tasks, now);
    expect(tasks.map(task => task.id)).toEqual([1, 2]);
  });
});

describe("home attention reasons", () => {
  const now = new Date(2026, 8, 9, 12);

  it("classifies overdue, support, and due-soon tasks", () => {
    expect(
      getTaskAttentionReason(
        { status: "in_progress", dueDate: "2026-09-08" },
        now
      )
    ).toBe("overdue");
    expect(
      getTaskAttentionReason(
        { status: "in_progress", dueDate: null, needsSupport: true },
        now
      )
    ).toBe("needs_support");
    expect(
      getTaskAttentionReason(
        { status: "in_progress", dueDate: "2026-09-12" },
        now
      )
    ).toBe("due_soon");
  });

  it("keeps blocked and completed tasks out of attention", () => {
    expect(
      getTaskAttentionReason(
        { status: "blocked", dueDate: "2026-09-08", needsSupport: true },
        now
      )
    ).toBeNull();
    expect(
      getTaskAttentionReason({ status: "complete", dueDate: "2026-09-08" }, now)
    ).toBeNull();
  });

  it("does not flag distant or undated work without support", () => {
    expect(
      getTaskAttentionReason(
        { status: "in_progress", dueDate: "2026-09-13" },
        now
      )
    ).toBeNull();
    expect(
      getTaskAttentionReason({ status: "in_progress", dueDate: null }, now)
    ).toBeNull();
  });
});

describe("task due-date filters", () => {
  const now = new Date(2026, 8, 9, 12);
  const task = (dueDate: string | null, status = "in_progress") => ({
    dueDate,
    status,
  });

  it("distinguishes overdue, today, this week, upcoming, and undated tasks", () => {
    expect(matchesTaskDueFilter(task("2026-09-08"), "overdue", now)).toBe(true);
    expect(matchesTaskDueFilter(task("2026-09-09"), "today", now)).toBe(true);
    expect(matchesTaskDueFilter(task("2026-09-10"), "week", now)).toBe(true);
    expect(matchesTaskDueFilter(task("2026-09-15"), "upcoming", now)).toBe(
      true
    );
    expect(matchesTaskDueFilter(task(null), "none", now)).toBe(true);
  });

  it("does not classify completed past work as overdue", () => {
    expect(
      matchesTaskDueFilter(task("2026-09-08", "complete"), "overdue", now)
    ).toBe(false);
  });
});
