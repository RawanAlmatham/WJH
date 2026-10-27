import { describe, it, expect } from "vitest";
import {
  businessData,
  businessSave,
  businessTotals,
  nextBusinessDate,
  type BusinessKind,
  type BusinessRecord,
} from "../shared/business";
const row = (
  kind: BusinessKind,
  amount: number,
  extra: Record<string, unknown> = {}
): BusinessRecord => ({
  id: 1,
  boardId: 1,
  kind,
  data: businessData.parse({ title: "اختبار", amount, ...extra }),
  version: 1,
  archived: false,
});
describe("business accounting and workflows", () => {
  it("distinguishes personal expenses from account payments and reserves reimbursements", () => {
    const rows = [
      row("contribution", 200000),
      row("expense", 4650),
      row("expense", 1200, { payerUserId: 2 }),
      row("obligation", 20000, { status: "قائم" }),
    ];
    expect(businessTotals(rows)).toMatchObject({
      capital: 200000,
      expenses: 5850,
      balance: 195350,
      reimbursements: 1200,
      available: 174150,
    });
    rows[2].data.reimbursed = true;
    expect(businessTotals(rows)).toMatchObject({
      balance: 194150,
      reimbursements: 0,
      available: 174150,
    });
  });
  it("does not remove settled financial entries through archiving", () => {
    const r = row("expense", 0.1);
    r.archived = true;
    expect(
      businessTotals([row("contribution", 1), r, row("expense", 0.2)])
    ).toMatchObject({ balance: 0.7, expenses: 0.3 });
  });
  it("replaces a paid commitment with expense without double counting", () => {
    expect(
      businessTotals([
        row("contribution", 100),
        row("obligation", 40, { status: "مدفوع" }),
        row("expense", 40),
      ])
    ).toMatchObject({ balance: 60, obligations: 0, available: 60 });
  });
  it("clamps monthly tasks to the next month and moves weekly dates across year end", () => {
    expect(nextBusinessDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextBusinessDate("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(nextBusinessDate("2026-12-29", "weekly")).toBe("2027-01-05");
  });
  it("rejects invalid dates, unsafe links, negative money and mismatched states", () => {
    expect(() =>
      businessData.parse({ title: "a", dueDate: "2026-02-31" })
    ).toThrow();
    expect(() =>
      businessData.parse({ title: "a", reference: "javascript:alert(1)" })
    ).toThrow();
    expect(() => businessData.parse({ title: "a", amount: -1 })).toThrow();
    expect(() =>
      businessSave.parse({
        boardId: 1,
        kind: "task",
        data: { title: "a", status: "مدفوع" },
      })
    ).toThrow();
  });
  it("requires real amounts and an owner for capital contributions", () => {
    expect(() =>
      businessSave.parse({ boardId: 1, kind: "expense", data: { title: "a" } })
    ).toThrow();
    expect(() =>
      businessSave.parse({
        boardId: 1,
        kind: "contribution",
        data: { title: "a", amount: 100 },
      })
    ).toThrow();
    expect(() => businessData.parse({ title: "a", amount: 0.111 })).toThrow();
  });
});
