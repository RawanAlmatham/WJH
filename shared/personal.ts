import { z } from "zod";
export const personalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    v =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "تاريخ غير صالح"
  );
export const personalTaskFields = z
  .object({
    title: z.string().trim().min(1).max(280),
    categoryId: z.number().int().positive().nullable(),
    dueDate: personalDate.nullable(),
    executionDate: personalDate.nullable(),
    executionTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
  })
  .refine(
    v => !v.executionTime || v.executionDate,
    "حدّد يوم التنفيذ مع الساعة"
  );
export function personalToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function suggestPersonalTasks<
  T extends {
    id: number;
    done: boolean;
    dueDate: string | null;
    focusDate: string | null;
  },
>(tasks: T[], today: string) {
  return tasks
    .filter(t => !t.done && t.dueDate && t.focusDate !== today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.id - b.id)
    .slice(0, 3);
}
export const personalCategories = ["شخصي", "عمل", "صحة", "بيت", "تعلّم"];
