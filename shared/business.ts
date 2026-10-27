import { z } from "zod";
import { personalDate } from "./personal";
export const businessKinds = [
  "project",
  "task",
  "expense",
  "contribution",
  "obligation",
  "supplier",
  "order",
  "document",
  "idea",
  "decision",
] as const;
export type BusinessKind = (typeof businessKinds)[number];
export const businessLabels: Record<BusinessKind, string> = {
  project: "منتج أو مشروع",
  task: "مهمة",
  expense: "مصروف",
  contribution: "مساهمة",
  obligation: "التزام",
  supplier: "مورد",
  order: "طلب شراء",
  document: "مستند",
  idea: "فكرة",
  decision: "قرار",
};
export const projectStages = {
  imported: [
    "الفكرة",
    "دراسة الموردين",
    "العينة",
    "الإنتاج",
    "الاستلام",
    "مكتمل",
  ],
  technical: ["الفكرة", "التحقق", "التصميم", "التطوير", "الإطلاق", "مكتمل"],
  other: ["الفكرة", "التخطيط", "التنفيذ", "المراجعة", "مكتمل"],
};
export const businessStatuses: Record<BusinessKind, string[]> = {
  project: projectStages.imported,
  task: ["قادمة", "قيد التنفيذ", "مكتملة"],
  expense: ["مدفوع"],
  contribution: ["مدفوع"],
  obligation: ["قائم", "مدفوع"],
  supplier: ["لم يُختبر", "قيد الفحص", "معتمد"],
  order: ["تأكيد", "تجهيز", "شحن", "استلام"],
  document: ["محفوظ", "مسودة للمراجعة", "معتمد"],
  idea: ["جديدة", "للنقاش", "قيد التحقق", "مؤجلة", "تحولت إلى مشروع"],
  decision: ["للمراجعة", "معتمد"],
};
const money = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000_000)
  .refine(
    n => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001,
    "استخدم منزلتين عشريتين للمبلغ"
  );
export const businessData = z.object({
  title: z.string().trim().min(1, "اكتب الاسم أو العنوان").max(240),
  type: z.enum(["imported", "technical", "other"]).default("imported"),
  status: z.string().max(60).default(""),
  assigneeUserId: z.number().int().positive().nullable().default(null),
  projectId: z.number().int().positive().nullable().default(null),
  supplierId: z.number().int().positive().nullable().default(null),
  fileId: z.number().int().positive().nullable().default(null),
  fileName: z.string().max(240).default(""),
  dueDate: personalDate.nullable().default(null),
  date: personalDate.nullable().default(null),
  nextStep: z.string().trim().max(2000).default(""),
  notes: z.string().max(10000).default(""),
  contact: z.string().trim().max(400).default(""),
  reference: z
    .union([
      z.literal(""),
      z
        .url()
        .max(2048)
        .refine(s => /^https?:\/\//i.test(s), "استخدم رابط http أو https"),
    ])
    .default(""),
  amount: money.default(0),
  payerUserId: z.number().int().positive().nullable().default(null),
  reimbursed: z.boolean().default(false),
  unitPrice: money.default(0),
  minimumQuantity: z.number().int().min(0).max(100000000).default(0),
  sampleCost: money.default(0),
  leadDays: z.number().int().min(0).max(10000).default(0),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  recurrence: z.enum(["none", "weekly", "monthly"]).default("none"),
  foundation: z.boolean().default(false),
});
export type BusinessData = z.infer<typeof businessData>;
export const businessSave = z
  .object({
    boardId: z.number().int().positive(),
    id: z.number().int().positive().optional(),
    version: z.number().int().positive().optional(),
    kind: z.enum(businessKinds),
    data: businessData,
  })
  .superRefine((v, ctx) => {
    const statuses =
      v.kind === "project"
        ? projectStages[v.data.type]
        : businessStatuses[v.kind];
    if (v.data.status && !statuses.includes(v.data.status))
      ctx.addIssue({
        code: "custom",
        path: ["data", "status"],
        message: "الحالة غير مناسبة لهذا السجل",
      });
    if (
      ["expense", "contribution", "obligation"].includes(v.kind) &&
      v.data.amount <= 0
    )
      ctx.addIssue({
        code: "custom",
        path: ["data", "amount"],
        message: "أدخل مبلغًا أكبر من صفر",
      });
    if (v.kind === "supplier" && !v.data.contact)
      ctx.addIssue({
        code: "custom",
        path: ["data", "contact"],
        message: "أدخل وسيلة التواصل",
      });
    if (v.kind === "contribution" && !v.data.assigneeUserId)
      ctx.addIssue({
        code: "custom",
        path: ["data", "assigneeUserId"],
        message: "اختر صاحب المساهمة",
      });
    if (v.kind === "project" && v.data.projectId)
      ctx.addIssue({
        code: "custom",
        path: ["data", "projectId"],
        message: "لا يمكن ربط مشروع بمشروع",
      });
    if (v.id && !v.version)
      ctx.addIssue({
        code: "custom",
        path: ["version"],
        message: "أعد فتح السجل قبل الحفظ",
      });
  });
export type BusinessRecord = {
  id: number;
  boardId: number;
  kind: BusinessKind;
  data: BusinessData;
  version: number;
  archived: boolean;
  convertedProjectId?: number | null;
};
export function businessTotals(rows: BusinessRecord[]) {
  const sum = (filter: (r: BusinessRecord) => boolean) =>
    rows
      .filter(r => filter(r))
      .reduce((s, r) => s + Math.round(r.data.amount * 100), 0);
  const capital = sum(r => r.kind === "contribution");
  const expenses = sum(r => r.kind === "expense");
  const accountExpenses = sum(
    r => r.kind === "expense" && (!r.data.payerUserId || r.data.reimbursed)
  );
  const reimbursements = sum(
    r => r.kind === "expense" && !!r.data.payerUserId && !r.data.reimbursed
  );
  const obligations = sum(
    r => r.kind === "obligation" && r.data.status !== "مدفوع"
  );
  const balance = capital - accountExpenses;
  return {
    capital: capital / 100,
    expenses: expenses / 100,
    balance: balance / 100,
    reimbursements: reimbursements / 100,
    obligations: obligations / 100,
    upcoming: (obligations + reimbursements) / 100,
    available: (balance - obligations - reimbursements) / 100,
  };
}
export function nextBusinessDate(
  date: string,
  recurrence: "weekly" | "monthly"
) {
  const d = new Date(date + "T12:00:00Z");
  if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}
