import { z } from "zod";

export const commerceStarterSections = [
  {
    name: "اختيار المنتج",
    tasks: ["تحديد المنتج والعميل المستهدف", "مقارنة المنتجات المنافسة"],
  },
  {
    name: "الموردون والعينات",
    tasks: ["مقارنة عروض الموردين", "طلب العينة وتقييم جودتها"],
  },
  {
    name: "المتطلبات والاستشارات",
    tasks: [
      "تجهيز أسئلة الاستيراد والاستشارة",
      "التحقق من متطلبات المنتج وتوثيق مصادرها",
    ],
  },
  {
    name: "التكلفة وقرار الطلب",
    tasks: [
      "جمع تكلفة المنتج والشحن والمصاريف",
      "اعتماد كمية وتكلفة أول طلبية",
    ],
  },
  {
    name: "الطلب والاستلام",
    tasks: [
      "تأكيد المواصفات مع المورد",
      "متابعة الشحن وفحص الطلبية عند الاستلام",
    ],
  },
  {
    name: "التجهيز للبيع",
    tasks: [
      "تجهيز التغليف والصور ووصف المنتج",
      "تجهيز قناة البيع وإطلاق أول دفعة",
    ],
  },
] as const;

export const commerceStatusLabels = {
  todo: "لم تبدأ",
  in_progress: "جاري العمل",
  blocked: "بانتظار",
  done: "مكتملة",
} as const;
export const commerceTaskFields = z.object({
  title: z.string().trim().min(1).max(280),
  sectionId: z.number().int().positive(),
  description: z.string().max(20_000).default(""),
  status: z.enum(["todo", "in_progress", "blocked", "done"]).default("todo"),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  assigneeUserId: z.number().int().positive().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      value =>
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value,
      "تاريخ غير صالح"
    )
    .nullable(),
  waitingReason: z.string().max(1000).default(""),
  checklist: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        text: z.string().trim().min(1).max(500),
        done: z.boolean(),
      })
    )
    .max(100)
    .default([]),
});
export type CommerceChecklist = z.infer<typeof commerceTaskFields>["checklist"];
export const commerceResourceFields = z.object({
  title: z.string().trim().min(1).max(280),
  url: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine(value => /^https?:\/\//i.test(value), "استخدم رابط http أو https"),
  notes: z.string().max(5000).default(""),
});

export function reorderCommerceSections(
  ids: number[],
  id: number,
  direction: "up" | "down"
) {
  const result = [...ids];
  const index = result.indexOf(id);
  const next = index + (direction === "up" ? -1 : 1);
  if (index < 0 || next < 0 || next >= result.length) return result;
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

export function matchesCommerceTask(
  task: {
    status: string;
    assigneeUserId: number | null;
    dueDate: string | null;
    archived: boolean;
  },
  view: string,
  userId: number,
  today: string
) {
  if (task.archived) return view === "archived";
  if (view === "archived") return false;
  if (view === "mine") return task.assigneeUserId === userId;
  if (view === "unassigned") return task.assigneeUserId === null;
  if (view === "today") return task.status !== "done" && task.dueDate === today;
  if (view === "overdue")
    return (
      task.status !== "done" && Boolean(task.dueDate && task.dueDate < today)
    );
  if (view === "waiting") return task.status === "blocked";
  if (view === "done") return task.status === "done";
  return task.status !== "done";
}
