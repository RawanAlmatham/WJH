import { describe, expect, it } from "vitest";
import {
  commerceTaskFields,
  commerceResourceFields,
  matchesCommerceTask,
  reorderCommerceSections,
} from "../shared/commerce";

describe("commerce task views and inputs", () => {
  const task = {
    status: "todo",
    assigneeUserId: 7,
    dueDate: "2026-10-10",
    archived: false,
  };
  it("shows newly assigned and unassigned tasks and separates completed/archived work", () => {
    expect(matchesCommerceTask(task, "mine", 7, "2026-10-10")).toBe(true);
    expect(
      matchesCommerceTask(
        { ...task, assigneeUserId: null },
        "unassigned",
        7,
        "2026-10-10"
      )
    ).toBe(true);
    expect(
      matchesCommerceTask({ ...task, status: "done" }, "open", 7, "2026-10-10")
    ).toBe(false);
    expect(
      matchesCommerceTask({ ...task, archived: true }, "today", 7, "2026-10-10")
    ).toBe(false);
    expect(
      matchesCommerceTask(
        { ...task, archived: true },
        "archived",
        7,
        "2026-10-10"
      )
    ).toBe(true);
  });
  it("counts waiting, due today and overdue tasks without counting completed tasks", () => {
    expect(matchesCommerceTask(task, "today", 7, "2026-10-10")).toBe(true);
    expect(matchesCommerceTask(task, "overdue", 7, "2026-10-11")).toBe(true);
    expect(
      matchesCommerceTask(
        { ...task, status: "done" },
        "overdue",
        7,
        "2026-10-11"
      )
    ).toBe(false);
    expect(
      matchesCommerceTask(
        { ...task, status: "blocked" },
        "waiting",
        7,
        "2026-10-10"
      )
    ).toBe(true);
  });
  it("rejects impossible dates and executable resource URLs", () => {
    const fields = {
      title: "طلب عينة",
      sectionId: 1,
      assigneeUserId: null,
      dueDate: "2026-02-30",
    };
    expect(commerceTaskFields.safeParse(fields).success).toBe(false);
    expect(
      commerceTaskFields.safeParse({ ...fields, dueDate: "2026-02-28" }).success
    ).toBe(true);
    expect(
      commerceResourceFields.safeParse({
        title: "عرض",
        url: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });
  it("moves only the selected section and keeps boundary moves unchanged", () => {
    expect(reorderCommerceSections([1, 2, 3], 2, "up")).toEqual([2, 1, 3]);
    expect(reorderCommerceSections([1, 2, 3], 1, "up")).toEqual([1, 2, 3]);
    expect(reorderCommerceSections([1, 2, 3], 9, "down")).toEqual([1, 2, 3]);
  });
});
