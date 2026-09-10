import { describe, expect, it } from "vitest";
import {
  calculateGoalProgress,
  calculateProjectProgress,
  calculateWorkload,
  shouldWarnAssignee,
  summarizeTasks,
} from "./db";

describe("workspace operating logic", () => {
  const tasks = [
    { assigneeMemberId: 1, status: "in_progress", priority: "high" },
    { assigneeMemberId: 1, status: "overdue", priority: "urgent" },
    { assigneeMemberId: 1, status: "not_started", priority: "medium" },
    { assigneeMemberId: 2, status: "complete", priority: "high" },
  ];

  it("classifies a high workload and identifies overdue work", () => {
    expect(calculateWorkload(tasks, 1)).toMatchObject({
      activeTaskCount: 3,
      overdueCount: 1,
      load: 9,
      loadStatus: "loaded",
    });
    expect(calculateWorkload(tasks, 2)).toMatchObject({
      activeTaskCount: 0,
      loadStatus: "available",
    });
  });

  it("counts one task for every assigned member when a task has multiple assignees", () => {
    const sharedTask = {
      assigneeMemberId: 1,
      assigneeMemberIds: [1, 2],
      status: "in_progress",
      priority: "high",
    };
    expect(calculateWorkload([sharedTask], 1).activeTaskCount).toBe(1);
    expect(calculateWorkload([sharedTask], 2).activeTaskCount).toBe(1);
  });

  it("warns before assignment when an assignee already has four active tasks", () => {
    expect(shouldWarnAssignee(3)).toBe(false);
    expect(shouldWarnAssignee(4)).toBe(true);
  });

  it("returns a concise report summary for operational reporting", () => {
    expect(
      summarizeTasks([
        { status: "complete" },
        { status: "overdue" },
        { status: "in_progress" },
        { status: "complete" },
      ])
    ).toEqual({ achievement: 50, overdue: 1, completed: 2, taskCount: 4 });
  });
});

describe("automatic project progress", () => {
  it("weights tasks at 70% and deliverables at 30%", () => {
    expect(
      calculateProjectProgress(
        [{ status: "complete" }, { status: "in_progress" }],
        [{ status: "complete" }]
      )
    ).toBe(65);
  });

  it("uses tasks alone when the project has no deliverables", () => {
    expect(
      calculateProjectProgress(
        [
          { status: "complete" },
          { status: "complete" },
          { status: "in_progress" },
          { status: "not_started" },
        ],
        []
      )
    ).toBe(50);
  });
});

describe("automatic annual goal progress", () => {
  it("uses the average progress of linked projects", () => {
    expect(
      calculateGoalProgress([
        { progress: 80 },
        { progress: 40 },
        { progress: 30 },
      ])
    ).toBe(50);
  });

  it("starts at zero before projects are linked", () => {
    expect(calculateGoalProgress([])).toBe(0);
  });
});
