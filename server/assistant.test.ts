import { describe, expect, it } from "vitest";
import { z } from "zod";
import { assistantPlan, assistantAction } from "../shared/assistant";
import { decodeAudio, validateActions } from "./assistant";

const action = assistantAction.parse({
  taskId: null,
  version: null,
  title: "مقارنة الموردين",
  sectionId: 1,
  dueDate: null,
  assigneeUserId: 10,
});
const data = {
  sections: [{ id: 1, archived: false }],
  tasks: [{ id: 2, version: 3, sectionId: 1, archived: false }],
  members: [],
  resources: [],
} as any;
describe("assistant proposal boundaries", () => {
  it("accepts only board sections, eligible assignees and current task versions", () => {
    expect(() => validateActions([action], data, [10])).not.toThrow();
    expect(() =>
      validateActions([{ ...action, sectionId: 99 }], data, [10])
    ).toThrow();
    expect(() =>
      validateActions([{ ...action, assigneeUserId: 99 }], data, [10])
    ).toThrow();
    expect(() =>
      validateActions([{ ...action, taskId: 99, version: 3 }], data, [10])
    ).toThrow();
    expect(() =>
      validateActions([{ ...action, taskId: 2, version: 2 }], data, [10])
    ).toThrow();
    expect(() =>
      validateActions([{ ...action, taskId: 2, version: 3 }], data, [10])
    ).not.toThrow();
  });
  it("rejects duplicated updates and tasks in archived sections", () => {
    const update = { ...action, taskId: 2, version: 3 };
    expect(() => validateActions([update, update], data, [10])).toThrow();
    expect(() =>
      validateActions(
        [action],
        { ...data, sections: [{ id: 1, archived: true }] },
        [10]
      )
    ).toThrow();
  });
  it("rejects invalid dates and oversized batches and supplies a fully required JSON schema", () => {
    expect(() =>
      assistantPlan.parse({ reply: "اقتراح", actions: Array(9).fill(action) })
    ).toThrow();
    expect(() =>
      assistantAction.parse({ ...action, dueDate: "2026-02-30" })
    ).toThrow();
    const schema = z.toJSONSchema(assistantPlan) as any;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.actions.items.required).toEqual(
      expect.arrayContaining([
        "taskId",
        "version",
        "status",
        "description",
        "checklist",
      ])
    );
  });
  it("validates audio bytes rather than trusting an extension", () => {
    const webm = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(16),
    ]).toString("base64");
    expect(decodeAudio(webm, "webm").length).toBe(20);
    expect(() => decodeAudio(webm, "mp4")).toThrow();
    expect(() =>
      decodeAudio(
        Buffer.from("this is not audio data").toString("base64"),
        "webm"
      )
    ).toThrow();
    expect(() => decodeAudio("#invalid", "webm")).toThrow();
  });
});
