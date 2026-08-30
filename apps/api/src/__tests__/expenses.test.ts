import { describe, expect, it } from "vitest";
import { decideExpense, summarizeExpenses } from "../lib/expenses";

describe("decideExpense", () => {
  it("approves a pending expense", () => {
    const result = decideExpense({ status: "pending" }, "approve");
    expect(result).toEqual({ ok: true, newStatus: "approved" });
  });

  it("rejects a pending expense", () => {
    const result = decideExpense({ status: "pending" }, "reject");
    expect(result).toEqual({ ok: true, newStatus: "rejected" });
  });

  it("refuses to re-decide an already approved expense", () => {
    const result = decideExpense({ status: "approved" }, "reject");
    expect(result).toEqual({ ok: false, reason: "not-pending" });
  });

  it("refuses to re-decide an already rejected expense", () => {
    const result = decideExpense({ status: "rejected" }, "approve");
    expect(result).toEqual({ ok: false, reason: "not-pending" });
  });
});

describe("summarizeExpenses", () => {
  const rows = [
    {
      categoryId: "c1",
      categoryName: "Maintenance",
      amount: 1000,
      status: "approved",
      date: "2026-01-15T00:00:00.000Z",
    },
    {
      categoryId: "c1",
      categoryName: "Maintenance",
      amount: 500,
      status: "approved",
      date: "2026-02-10T00:00:00.000Z",
    },
    {
      categoryId: "c2",
      categoryName: "Utilities",
      amount: 2000,
      status: "approved",
      date: "2026-01-20T00:00:00.000Z",
    },
    {
      categoryId: "c2",
      categoryName: "Utilities",
      amount: 9999,
      status: "rejected",
      date: "2026-01-05T00:00:00.000Z",
    },
    {
      categoryId: "c1",
      categoryName: "Maintenance",
      amount: 300,
      status: "pending",
      date: "2026-02-25T00:00:00.000Z",
    },
  ];

  it("totals only approved expenses", () => {
    expect(summarizeExpenses(rows).total).toBe(3500);
  });

  it("excludes rejected expenses from every total entirely", () => {
    const summary = summarizeExpenses(rows);
    const utilities = summary.byCategory.find((c) => c.categoryId === "c2");
    expect(utilities?.total).toBe(2000);
    expect(utilities?.count).toBe(1);
  });

  it("tracks pending separately without inflating the approved total", () => {
    const summary = summarizeExpenses(rows);
    expect(summary.pendingTotal).toBe(300);
    expect(summary.total).toBe(3500);
  });

  it("aggregates by category, sorted descending by total", () => {
    const summary = summarizeExpenses(rows);
    expect(summary.byCategory).toEqual([
      { categoryId: "c2", categoryName: "Utilities", total: 2000, count: 1 },
      { categoryId: "c1", categoryName: "Maintenance", total: 1500, count: 2 },
    ]);
  });

  it("aggregates by month, sorted ascending", () => {
    const summary = summarizeExpenses(rows);
    expect(summary.byMonth).toEqual([
      { month: "2026-01", total: 3000, count: 2 },
      { month: "2026-02", total: 500, count: 1 },
    ]);
  });

  it("returns zeroes for no expenses", () => {
    expect(summarizeExpenses([])).toEqual({
      total: 0,
      pendingTotal: 0,
      byCategory: [],
      byMonth: [],
    });
  });
});
