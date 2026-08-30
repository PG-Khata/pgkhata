import { describe, expect, it } from "vitest";
import { computeDueDate } from "../lib/due-date";

describe("computeDueDate", () => {
  it("places the due date within the bill month", () => {
    const due = computeDueDate("2026-05", 5);

    expect(due.getUTCFullYear()).toBe(2026);
    expect(due.getUTCMonth()).toBe(4); // 0-indexed May
    expect(due.getUTCDate()).toBe(5);
  });

  it("supports the full 1-28 range without a February overflow", () => {
    const due = computeDueDate("2026-02", 28);

    expect(due.getUTCMonth()).toBe(1);
    expect(due.getUTCDate()).toBe(28);
  });

  it("supports the earliest day of the month", () => {
    const due = computeDueDate("2026-01", 1);

    expect(due.getUTCDate()).toBe(1);
  });

  it("rejects a month not in YYYY-MM form", () => {
    expect(() => computeDueDate("May 2026", 5)).toThrow();
    expect(() => computeDueDate("2026-5", 5)).toThrow();
  });
});
