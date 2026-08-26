import { describe, expect, it } from "vitest";
import { calculateWorkload, shouldWarnAssignee, summarizeTasks } from "./db";

describe("workspace operating logic", () => {
  const tasks = [
    { assigneeMemberId: 1, status: "in_progress", priority: "high" },
    { assigneeMemberId: 1, status: "overdue", priority: "urgent" },
    { assigneeMemberId: 1, status: "not_started", priority: "medium" },
    { assigneeMemberId: 2, status: "complete", priority: "high" },
  ];

  it("classifies a high workload and identifies overdue work", () => {
    expect(calculateWorkload(tasks, 1)).toMatchObject({ activeTaskCount: 3, overdueCount: 1, load: 9, loadStatus: "loaded" });
    expect(calculateWorkload(tasks, 2)).toMatchObject({ activeTaskCount: 0, loadStatus: "available" });
  });

  it("warns before assignment when an assignee already has four active tasks", () => {
    expect(shouldWarnAssignee(3)).toBe(false);
    expect(shouldWarnAssignee(4)).toBe(true);
  });

  it("returns a concise report summary for operational reporting", () => {
    expect(summarizeTasks([{ status: "complete" }, { status: "overdue" }, { status: "in_progress" }, { status: "complete" }])).toEqual({ achievement: 50, overdue: 1, completed: 2, taskCount: 4 });
  });
});
