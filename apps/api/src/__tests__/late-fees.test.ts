import { describe, expect, it } from "vitest";
import { calculateLateFee } from "../lib/late-fee";

function base() {
  return {
    dueDate: "2026-06-05T00:00:00.000Z",
    lateFeePerDay: 50,
    asOf: new Date("2026-06-10T00:00:00.000Z"),
    balance: 6000,
    voidedAt: null,
  };
}

describe("calculateLateFee", () => {
  it("charges nothing on the due date itself", () => {
    const result = calculateLateFee({ ...base(), asOf: new Date("2026-06-05T00:00:00.000Z") });

    expect(result).toEqual({ amount: 0, daysOverdue: 0 });
  });

  it("charges nothing the day before the due date", () => {
    const result = calculateLateFee({ ...base(), asOf: new Date("2026-06-04T00:00:00.000Z") });

    expect(result.amount).toBe(0);
  });

  it("charges for exactly one day starting the day after due", () => {
    const result = calculateLateFee({ ...base(), asOf: new Date("2026-06-06T00:00:00.000Z") });

    expect(result).toEqual({ amount: 50, daysOverdue: 1 });
  });

  it("accrues linearly with days overdue", () => {
    const result = calculateLateFee({ ...base(), asOf: new Date("2026-06-10T00:00:00.000Z") });

    // 5th -> 10th is 5 days overdue.
    expect(result).toEqual({ amount: 250, daysOverdue: 5 });
  });

  it("ignores the time of day, only the calendar date", () => {
    const result = calculateLateFee({
      ...base(),
      dueDate: "2026-06-05T23:00:00.000Z",
      asOf: new Date("2026-06-06T01:00:00.000Z"),
    });

    expect(result).toEqual({ amount: 50, daysOverdue: 1 });
  });

  it("charges nothing on a fully paid bill regardless of how overdue it is", () => {
    const result = calculateLateFee({ ...base(), balance: 0, asOf: new Date("2026-07-01T00:00:00.000Z") });

    expect(result.amount).toBe(0);
  });

  it("charges nothing on a voided bill", () => {
    const result = calculateLateFee({ ...base(), voidedAt: new Date("2026-06-06T00:00:00.000Z") });

    expect(result.amount).toBe(0);
  });

  it("charges nothing when the plan carries no late fee rate", () => {
    const result = calculateLateFee({ ...base(), lateFeePerDay: null });

    expect(result.amount).toBe(0);
  });

  it("charges nothing when the bill has no due date at all", () => {
    const result = calculateLateFee({ ...base(), dueDate: null });

    expect(result.amount).toBe(0);
  });

  it("treats a zero late fee rate the same as none", () => {
    const result = calculateLateFee({ ...base(), lateFeePerDay: 0 });

    expect(result.amount).toBe(0);
  });

  it("charges only on the unpaid balance's overdue state, not the original total", () => {
    // A ₹6000 bill down to ₹500 balance is still late, just for less money.
    const result = calculateLateFee({ ...base(), balance: 500 });

    expect(result.amount).toBe(250);
  });
});
