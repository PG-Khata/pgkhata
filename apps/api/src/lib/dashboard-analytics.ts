/** Whole days between an overdue bill's due date and "today", floor at 0. */
export function daysOverdue(dueDate: Date | string | null, asOf: Date = new Date()): number {
  if (!dueDate) return 0;
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(asOf);
  const diff = Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

/**
 * Buckets an overdue balance by age. "current" is a balance that is not yet
 * overdue at all (0 days) — everything from day 1 onward falls into a 30-day
 * band. Boundaries are inclusive on the upper edge: exactly 30 days overdue
 * is still "0-30", not "31-60".
 */
export function agingBucketFor(days: number): AgingBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export interface AgingRow {
  tenantId: string;
  balance: number;
  daysOverdue: number;
}

export interface AgingBucketSummary {
  bucket: AgingBucket;
  total: number;
  count: number;
}

export interface AgingReport {
  buckets: AgingBucketSummary[];
  total: number;
}

const BUCKET_ORDER: AgingBucket[] = ["current", "0-30", "31-60", "61-90", "90+"];

/**
 * Groups outstanding balances into aging buckets. Every bucket is present in
 * the output even with zero rows, so a frontend chart never has to guess
 * which buckets exist — the shape is always the same five buckets in order.
 */
export function summarizeAging(rows: AgingRow[]): AgingReport {
  const totals = new Map<AgingBucket, { total: number; count: number }>();
  for (const bucketName of BUCKET_ORDER) totals.set(bucketName, { total: 0, count: 0 });

  let total = 0;
  for (const row of rows) {
    const bucketName = agingBucketFor(row.daysOverdue);
    const entry = totals.get(bucketName)!;
    entry.total += row.balance;
    entry.count += 1;
    total += row.balance;
  }

  return {
    buckets: BUCKET_ORDER.map((bucketName) => ({
      bucket: bucketName,
      ...totals.get(bucketName)!,
    })),
    total,
  };
}

export interface TrendMonthInput {
  month: string; // "YYYY-MM"
  collected: number;
  expenses: number;
}

/**
 * Fills in the last `months` calendar months (including the current one)
 * ending at `asOf`, so a month with no bills or expenses still appears as a
 * zero point on the trend chart instead of a gap.
 */
export function buildMonthlyTrend(
  rows: TrendMonthInput[],
  months: number,
  asOf: Date = new Date(),
): TrendMonthInput[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const result: TrendMonthInput[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = byMonth.get(month);
    result.push(existing ?? { month, collected: 0, expenses: 0 });
  }

  return result;
}
