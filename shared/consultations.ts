import { z } from "zod";

export const consultationQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().trim().min(1).max(2000),
  priority: z.enum(["high", "normal", "later"]),
  answer: z.string().max(10000),
});
export type ConsultationQuestion = z.infer<typeof consultationQuestionSchema>;
export const consultationFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "أضف عنوانًا للاستشارة من حرفين على الأقل")
    .max(280),
  consultant: z.string().trim().max(280),
  goal: z.string().trim().max(5000),
  status: z.enum(["preparing", "ready", "completed"]),
  questions: z
    .array(consultationQuestionSchema)
    .max(60)
    .refine(
      items => new Set(items.map(item => item.id)).size === items.length,
      "معرّفات الأسئلة يجب أن تكون فريدة"
    ),
  summary: z.string().max(20000),
  recommendations: z.string().max(20000),
});
export type ConsultationFields = z.infer<typeof consultationFieldsSchema>;
