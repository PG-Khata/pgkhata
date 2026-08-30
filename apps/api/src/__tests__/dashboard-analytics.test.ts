import { describe, expect, it } from "vitest";
import {
  daysOverdue,
  agingBucketFor,
  summarizeAging,
  buildMonthlyTrend,
} from "../lib/dashboard-analytics";

describe("daysOverdue", () => {
  it("is zero on the due date itself", () => {
    expect(daysOverdue("2026-08-10", new Date(2026, 7, 10))).toBe(0);
  });

  it("is zero before the due date", () => {
    expect(daysOverdue("2026-08-10", new Date(2026, 7, 5))).toBe(0);
  });

  it("counts whole days after the due date", () => {
    expect(daysOverdue("2026-08-10", new Date(2026, 7, 15))).toBe(5);
  });

  it("is zero when there is no due date", () => {
    expect(daysOverdue(null, new Date(2026, 7, 15))).toBe(0);
  });

  it("ignores time-of-day", () => {
    const due = new Date(2026, 7, 10, 23, 59);
    const today = new Date(2026, 7, 11, 0, 1);
    expect(daysOverdue(due, today)).toBe(1);
  });
});

describe("agingBucketFor", () => {
  it("buckets zero or negative days as current", () => {
    expect(agingBucketFor(0)).toBe("current");
    expect(agingBucketFor(-5)).toBe("current");
  });

  it("buckets 1-30 days as 0-30", () => {
    expect(agingBucketFor(1)).toBe("0-30");
    expect(agingBucketFor(30)).toBe("0-30");
  });

  it("buckets 31-60 days as 31-60", () => {
    expect(agingBucketFor(31)).toBe("31-60");
    expect(agingBucketFor(60)).toBe("31-60");
  });

  it("buckets 61-90 days as 61-90", () => {
    expect(agingBucketFor(61)).toBe("61-90");
    expect(agingBucketFor(90)).toBe("61-90");
  });

  it("buckets anything past 90 days as 90+", () => {
    expect(agingBucketFor(91)).toBe("90+");
    expect(agingBucketFor(500)).toBe("90+");
  });
});

describe("summarizeAging", () => {
  it("always returns all five buckets, even with no rows", () => {
    const report = summarizeAging([]);
    expect(report.buckets.map((b) => b.bucket)).toEqual([
      "current",
      "0-30",
      "31-60",
      "61-90",
      "90+",
    ]);
    expect(report.buckets.every((b) => b.total === 0 && b.count === 0)).toBe(true);
    expect(report.total).toBe(0);
  });

  it("sums balances into the correct bucket", () => {
    const report = summarizeAging([
      { tenantId: "t1", balance: 1000, daysOverdue: 0 },
      { tenantId: "t2", balance: 2000, daysOverdue: 15 },
      { tenantId: "t3", balance: 3000, daysOverdue: 45 },
      { tenantId: "t4", balance: 4000, daysOverdue: 75 },
      { tenantId: "t5", balance: 5000, daysOverdue: 100 },
    ]);

    expect(report.buckets).toEqual([
      { bucket: "current", total: 1000, count: 1 },
      { bucket: "0-30", total: 2000, count: 1 },
      { bucket: "31-60", total: 3000, count: 1 },
      { bucket: "61-90", total: 4000, count: 1 },
      { bucket: "90+", total: 5000, count: 1 },
    ]);
    expect(report.total).toBe(15000);
  });

  it("aggregates multiple rows within the same bucket", () => {
    const report = summarizeAging([
      { tenantId: "t1", balance: 1000, daysOverdue: 5 },
      { tenantId: "t2", balance: 500, daysOverdue: 20 },
    ]);

    const bucket = report.buckets.find((b) => b.bucket === "0-30");
    expect(bucket).toEqual({ bucket: "0-30", total: 1500, count: 2 });
  });
});

describe("buildMonthlyTrend", () => {
  it("fills every month in range even with no data", () => {
    const trend = buildMonthlyTrend([], 6, new Date(2026, 7, 15)); // Aug 2026
    expect(trend).toHaveLength(6);
    expect(trend[0]!.month).toBe("2026-03");
    expect(trend[5]!.month).toBe("2026-08");
    expect(trend.every((m) => m.collected === 0 && m.expenses === 0)).toBe(true);
  });

  it("fills in known months and zeroes the gaps", () => {
    const trend = buildMonthlyTrend(
      [{ month: "2026-06", collected: 5000, expenses: 1000 }],
      3,
      new Date(2026, 7, 15), // Aug 2026 -> Jun, Jul, Aug
    );

    expect(trend).toEqual([
      { month: "2026-06", collected: 5000, expenses: 1000 },
      { month: "2026-07", collected: 0, expenses: 0 },
      { month: "2026-08", collected: 0, expenses: 0 },
    ]);
  });

  it("handles a year boundary", () => {
    const trend = buildMonthlyTrend([], 3, new Date(2026, 1, 1)); // Feb 2026
    expect(trend.map((m) => m.month)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});
