import { z } from "zod";
import { commerceTaskFields } from "./commerce";

export const assistantAction = commerceTaskFields.extend({
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
