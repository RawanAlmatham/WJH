import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  businessRecords as records,
  businessFiles,
  managementBoards,
  boardMemberships,
  users,
} from "../drizzle/schema";
import {
  businessData,
  businessSave,
  businessStatuses,
  nextBusinessDate,
  type BusinessData,
  type BusinessRecord,
} from "../shared/business";
import { personalToday } from "../shared/personal";
import type { z } from "zod";
type DB = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type BusinessTx = Parameters<Parameters<DB["transaction"]>[0]>[0];
const fail = (
  message: string,
  code: "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" = "BAD_REQUEST"
): never => {
  throw new TRPCError({ code, message });
};
async function database() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db;
}
export async function checkBusinessAccess(
  db: DB | BusinessTx,
  boardId: number,
  userId: number,
  write = false
) {
  const [board] = await db
    .select()
    .from(managementBoards)
    .where(eq(managementBoards.id, boardId));
  if (board?.deletedAt || board?.template !== "business")
    fail("هذه ليست لوحة إدارة الأعمال");
  const members = await db
    .select()
    .from(boardMemberships)
    .where(eq(boardMemberships.boardId, boardId));
  const membership = members.find(m => m.userId === userId);
  if (!membership || (write && membership.role === "viewer"))
    fail("ليس لديك صلاحية لهذه العملية", "FORBIDDEN");
  return members;
}
export async function overview(boardId: number, userId: number) {
  const db = await database();
  await checkBusinessAccess(db, boardId, userId);
  const [rows, members] = await Promise.all([
    db
      .select()
      .from(records)
      .where(eq(records.boardId, boardId))
      .orderBy(records.id),
    db
      .select({
        userId: users.id,
        name: users.name,
        role: boardMemberships.role,
      })
      .from(boardMemberships)
      .innerJoin(users, eq(users.id, boardMemberships.userId))
      .where(eq(boardMemberships.boardId, boardId)),
  ]);
  return { records: rows, members, today: personalToday() };
}
export async function businessWrite<T>(
  boardId: number,
  userId: number,
  fn: (tx: BusinessTx) => Promise<T>
) {
  const db = await database();
  return db.transaction(async tx => {
    await tx
      .select()
      .from(managementBoards)
      .where(eq(managementBoards.id, boardId))
      .for("update");
    await checkBusinessAccess(tx, boardId, userId, true);
    return fn(tx);
  });
}
export async function validateBusinessLinks(
  tx: BusinessTx,
  boardId: number,
  data: BusinessData
) {
  const members = await tx
    .select()
    .from(boardMemberships)
    .where(eq(boardMemberships.boardId, boardId));
  for (const userId of [data.assigneeUserId, data.payerUserId])
    if (
      userId &&
      !members.some(m => m.userId === userId && m.role !== "viewer")
    )
      fail("اختر عضوًا من فريق اللوحة");
  for (const [id, kind] of [
    [data.projectId, "project"],
    [data.supplierId, "supplier"],
  ] as const)
    if (id) {
      const [row] = await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.id, id),
            eq(records.boardId, boardId),
            eq(records.kind, kind),
            eq(records.archived, false)
          )
        );
      if (!row) fail("الارتباط غير متاح في اللوحة الحالية");
    }
  if (data.fileId) {
    const [file] = await tx
      .select({ id: businessFiles.id, name: businessFiles.name })
      .from(businessFiles)
      .where(
        and(
          eq(businessFiles.id, data.fileId),
          eq(businessFiles.boardId, boardId)
        )
      );
    if (!file) fail("الملف غير متاح في اللوحة");
    data.fileName = file.name;
  } else data.fileName = "";
}
export async function saveBusinessRecord(
  tx: BusinessTx,
  boardId: number,
  input: Omit<z.infer<typeof businessSave>, "boardId">
) {
  const { kind, id, version } = input;
  const data = {
    ...input.data,
    status: input.data.status || businessStatuses[kind][0],
  };
  await validateBusinessLinks(tx, boardId, data);
  if (kind === "idea" && data.status === "تحولت إلى مشروع") {
    const [existing] = id
      ? await tx
          .select()
          .from(records)
          .where(and(eq(records.id, id), eq(records.boardId, boardId)))
      : [];
    if (!existing?.convertedProjectId)
      fail("استخدم تحويل إلى مشروع لإنشاء المشروع المرتبط");
  }
  if (!id && kind === "obligation" && data.status === "مدفوع")
    fail("أضف الالتزام ثم سجّل الدفع من زر تسجيل الدفع");
  if (!id && kind === "expense" && data.reimbursed)
    fail("سجّل التعويض بعد حفظ المصروف");
  if (!id) {
    const result = await tx.insert(records).values({ boardId, kind, data });
    return { id: Number(result[0].insertId) };
  }
  const [current] = await tx
    .select()
    .from(records)
    .where(
      and(
        eq(records.id, id),
        eq(records.boardId, boardId),
        eq(records.archived, false)
      )
    )
    .for("update");
  if (!current || current.kind !== kind) fail("السجل غير متاح", "NOT_FOUND");
  if (kind === "obligation" && current.data.status !== data.status)
    fail("استخدم تسجيل الدفع لتسديد الالتزام");
  if (kind === "expense" && current.data.reimbursed !== data.reimbursed)
    fail("استخدم تسجيل التعويض لتعويض المصروف");
  if (current.version !== version)
    fail("تغير السجل لدى شريكك. حدّث الصفحة وأعد فتحه", "CONFLICT");
  // Money already settled cannot silently change its financial meaning.
  if (
    (kind === "expense" && current.data.reimbursed) ||
    (kind === "obligation" && current.data.status === "مدفوع")
  ) {
    if (
      data.amount !== current.data.amount ||
      data.payerUserId !== current.data.payerUserId ||
      data.reimbursed !== current.data.reimbursed ||
      data.status !== current.data.status
    )
      fail("السجل مسدد. يمكنك تعديل الوصف والملاحظات فقط");
  }
  if (
    kind === "idea" &&
    current.convertedProjectId &&
    data.status !== "تحولت إلى مشروع"
  )
    fail("الفكرة مرتبطة بمشروع تم إنشاؤه");
  await tx
    .update(records)
    .set({ data, version: current.version + 1 })
    .where(eq(records.id, id));
  if (
    kind === "task" &&
    current.data.status !== "مكتملة" &&
    data.status === "مكتملة" &&
    data.recurrence !== "none" &&
    !current.nextOccurrenceId
  ) {
    const next = nextBusinessDate(
      data.dueDate ?? personalToday(),
      data.recurrence
    );
    const nextResult = await tx.insert(records).values({
      boardId,
      kind: "task",
      data: { ...data, status: "قادمة", dueDate: next },
    });
    await tx
      .update(records)
      .set({ nextOccurrenceId: Number(nextResult[0].insertId) })
      .where(eq(records.id, id));
  }
  return { id };
}
export async function save(
  boardId: number,
  userId: number,
  input: z.infer<typeof businessSave>
) {
  return businessWrite(boardId, userId, tx =>
    saveBusinessRecord(tx, boardId, input)
  );
}
export async function action(
  boardId: number,
  userId: number,
  input: {
    id: number;
    version: number;
    action: "archive" | "restore" | "convert" | "settle" | "reimburse";
  }
) {
  return businessWrite(boardId, userId, async tx => {
    const [row] = await tx
      .select()
      .from(records)
      .where(and(eq(records.boardId, boardId), eq(records.id, input.id)))
      .for("update");
    if (!row) fail("السجل غير متاح", "NOT_FOUND");
    if (row.version !== input.version)
      fail("تغير السجل. حدّث الصفحة أولًا", "CONFLICT");
    if (input.action === "archive" || input.action === "restore") {
      await tx
        .update(records)
        .set({ archived: input.action === "archive", version: row.version + 1 })
        .where(eq(records.id, row.id));
      return { id: row.id };
    }
    if (row.archived) fail("استعد السجل قبل تعديله");
    if (input.action === "convert") {
      if (row.kind !== "idea") fail("يمكن تحويل الأفكار فقط");
      if (row.convertedProjectId) return { id: row.convertedProjectId };
      await validateBusinessLinks(tx, boardId, row.data);
      const data = businessData.parse({
        ...row.data,
        projectId: null,
        status: "الفكرة",
      });
      const result = await tx
        .insert(records)
        .values({ boardId, kind: "project", data });
      const id = Number(result[0].insertId);
      await tx
        .update(records)
        .set({
          convertedProjectId: id,
          data: { ...row.data, status: "تحولت إلى مشروع" },
          version: row.version + 1,
        })
        .where(eq(records.id, row.id));
      return { id };
    }
    if (input.action === "settle") {
      if (row.kind !== "obligation" || row.data.status === "مدفوع")
        fail("الالتزام غير قابل للتسديد");
      await tx.insert(records).values({
        boardId,
        kind: "expense",
        data: {
          ...row.data,
          status: "مدفوع",
          date: personalToday(),
          payerUserId: null,
          reimbursed: false,
        },
      });
      await tx
        .update(records)
        .set({
          data: { ...row.data, status: "مدفوع" },
          version: row.version + 1,
        })
        .where(eq(records.id, row.id));
      return { id: row.id };
    }
    if (row.kind !== "expense" || !row.data.payerUserId || row.data.reimbursed)
      fail("هذا المصروف لا يحتاج تعويضًا");
    await tx
      .update(records)
      .set({
        data: { ...row.data, reimbursed: true },
        version: row.version + 1,
      })
      .where(eq(records.id, row.id));
    return { id: row.id };
  });
}
const fileTypes: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpe?g",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/csv": "csv",
};
export async function upload(
  boardId: number,
  userId: number,
  input: { name: string; mime: string; body: string }
) {
  if (
    !fileTypes[input.mime] ||
    !new RegExp("\\.(" + fileTypes[input.mime] + ")$", "i").test(input.name)
  )
    fail("استخدم PDF أو صورة أو Word أو Excel أو ملف نصي");
  const bytes = Buffer.from(input.body, "base64");
  if (
    !bytes.length ||
    bytes.length > 10 * 1024 * 1024 ||
    bytes.toString("base64") !== input.body
  )
    fail("الملف غير صالح أو أكبر من 10 ميغابايت");
  return businessWrite(boardId, userId, async tx => {
    const result = await tx.insert(businessFiles).values({ boardId, ...input });
    return { id: Number(result[0].insertId), name: input.name };
  });
}
export async function download(boardId: number, userId: number, id: number) {
  const db = await database();
  await checkBusinessAccess(db, boardId, userId);
  const [file] = await db
    .select()
    .from(businessFiles)
    .where(and(eq(businessFiles.id, id), eq(businessFiles.boardId, boardId)));
  if (!file) fail("الملف غير متاح", "NOT_FOUND");
  return { name: file.name, mime: file.mime, body: file.body };
}
