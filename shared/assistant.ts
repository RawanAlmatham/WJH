import { z } from "zod";
import { commerceTaskFields } from "./commerce";
import { personalDate } from "./personal";

export const assistantAction = commerceTaskFields.extend({
  sectionId: z.number().int().positive().nullable(),
  priority: z
    .enum(["normal", "urgent", "low", "medium", "high"])
    .default("normal"),
  status: z
    .enum(["todo", "in_progress", "blocked", "done", "in_review", "overdue"])
    .default("todo"),
  executionDate: personalDate.nullable().default(null),
  executionTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
  focusDate: personalDate.nullable().default(null),
  taskId: z.number().int().positive().nullable(),
  version: z.number().int().positive().nullable(),
});
export const assistantPlan = z.object({
  reply: z.string().trim().min(1).max(6000),
  actions: z.array(assistantAction).max(8),
});
export type AssistantAction = z.infer<typeof assistantAction>;
export const assistantHistory = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(6000),
    })
  )
  .max(8);
export const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
export const audioFormats = ["webm", "ogg", "wav", "mp4"] as const;
