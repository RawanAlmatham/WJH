import { describe, expect, it } from "vitest";
import {
  initialTaskAssignee,
  matchesIdeaTaskView,
} from "../shared/ideaTaskVisibility";

describe("idea task visibility", () => {
  it("assigns a new task to its creator so it appears in their tasks", () => {
    const assigneeUserId = initialTaskAssignee(null, 7);
    expect(matchesIdeaTaskView({ id: 1, assigneeUserId }, [], 7, "mine")).toBe(
      true
    );
  });

  it("preserves explicitly unassigned tasks when editing", () => {
    expect(initialTaskAssignee({ assigneeUserId: null }, 7)).toBeNull();
    expect(initialTaskAssignee({ assigneeUserId: 8 }, 7)).toBe(8);
  });

  it("makes existing unassigned tasks accessible without reassigning them", () => {
    const task = { id: 1, assigneeUserId: null };
    expect(matchesIdeaTaskView(task, [], 7, "mine")).toBe(false);
    expect(matchesIdeaTaskView(task, [], 7, "unassigned")).toBe(true);
    expect(matchesIdeaTaskView(task, [], 7, "all")).toBe(true);
  });

  it("includes tasks with my subtasks but excludes another person's tasks", () => {
    const task = { id: 1, assigneeUserId: 8 };
    expect(
      matchesIdeaTaskView(task, [{ taskId: 1, assigneeUserId: 7 }], 7, "mine")
    ).toBe(true);
    expect(
      matchesIdeaTaskView(task, [{ taskId: 2, assigneeUserId: 7 }], 7, "mine")
    ).toBe(false);
    expect(matchesIdeaTaskView(task, [], 7, "unassigned")).toBe(false);
  });
});
