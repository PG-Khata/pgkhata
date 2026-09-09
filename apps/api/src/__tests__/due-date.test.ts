import { describe, expect, it } from "vitest";
import { businessDate, computeDueDate, isOverdue } from "../lib/due-date";

describe("computeDueDate", () => {
  it("uses the rent-plan due day in the billed month", () => {
    const due = computeDueDate("2026-09", 8);

    expect(due.getUTCFullYear()).toBe(2026);
    expect(due.getUTCMonth()).toBe(8); // 0-indexed September
    expect(due.getUTCDate()).toBe(8);
  });

  it("defaults missing plans to day five", () => {
    expect(computeDueDate("2026-02").toISOString()).toBe("2026-02-05T00:00:00.000Z");
  });

  it("rejects values outside the schema's 1-28 range", () => {
    expect(() => computeDueDate("2026-01", 0)).toThrow();
    expect(() => computeDueDate("2026-01", 29)).toThrow();
  });

  it("changes to overdue at midnight in Asia/Kolkata", () => {
    const justBeforeMidnight = new Date("2026-09-08T18:29:59.999Z");
    const midnight = new Date("2026-09-08T18:30:00.000Z");
    expect(isOverdue("2026-09-08", justBeforeMidnight)).toBe(false);
    expect(isOverdue("2026-09-08", midnight)).toBe(true);
    expect(businessDate(midnight).toISOString()).toBe("2026-09-09T00:00:00.000Z");
  });
});
