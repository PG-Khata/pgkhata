/**
 * Decides the effect of approving or rejecting a pending expense.
 * Both decisions are terminal — an already-approved or already-rejected
 * expense cannot be re-decided, so a second approve/reject call is rejected
 * rather than silently overwriting the first decision.
 */
export type ExpenseDecisionResult =
  | { ok: true; newStatus: "approved" | "rejected" }
  | { ok: false; reason: "not-pending" };

export function decideExpense(
  expense: { status: string },
  decision: "approve" | "reject",
): ExpenseDecisionResult {
  if (expense.status !== "pending") {
    return { ok: false, reason: "not-pending" };
  }
  return { ok: true, newStatus: decision === "approve" ? "approved" : "rejected" };
}

export interface ExpenseSummaryInput {
  categoryId: string;
  categoryName: string;
  amount: number;
  status: string;
  date: Date | string;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
}

export interface MonthSummary {
  month: string; // "YYYY-MM"
  total: number;
  count: number;
}

export interface ExpenseSummary {
  total: number;
  pendingTotal: number;
  byCategory: CategorySummary[];
  byMonth: MonthSummary[];
}

/**
 * Aggregates approved-only spend by category and by month, plus a separate
 * pendingTotal so a pending expense never inflates the "actual spend" total
 * before the owner has approved it. Rejected expenses are excluded entirely —
 * they never happened as far as the books are concerned.
 */
export function summarizeExpenses(expenses: ExpenseSummaryInput[]): ExpenseSummary {
  const approved = expenses.filter((e) => e.status === "approved");
  const pending = expenses.filter((e) => e.status === "pending");

  const total = approved.reduce((sum, e) => sum + e.amount, 0);
  const pendingTotal = pending.reduce((sum, e) => sum + e.amount, 0);

  const categoryMap = new Map<string, CategorySummary>();
  for (const e of approved) {
    const existing = categoryMap.get(e.categoryId);
    if (existing) {
      existing.total += e.amount;
      existing.count += 1;
    } else {
      categoryMap.set(e.categoryId, {
        categoryId: e.categoryId,
        categoryName: e.categoryName,
        total: e.amount,
        count: 1,
      });
    }
  }

  const monthMap = new Map<string, MonthSummary>();
  for (const e of approved) {
    const d = new Date(e.date);
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const existing = monthMap.get(month);
    if (existing) {
      existing.total += e.amount;
      existing.count += 1;
    } else {
      monthMap.set(month, { month, total: e.amount, count: 1 });
    }
  }

  return {
    total,
    pendingTotal,
    byCategory: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
    byMonth: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
  };
}
