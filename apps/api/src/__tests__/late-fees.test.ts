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

  it("ignores the time of day, counting only the IST calendar date", () => {
    // 05:00 IST and 20:00 IST on 2026-06-06 are the same business day, so both
    // are exactly one day past a 2026-06-05 due date. Day count uses the
    // Asia/Kolkata calendar to agree with isOverdue / the billing engine.
    const morning = calculateLateFee({
      ...base(),
      asOf: new Date("2026-06-05T23:30:00.000Z"), // 2026-06-06 05:00 IST
    });
    const evening = calculateLateFee({
      ...base(),
      asOf: new Date("2026-06-06T14:30:00.000Z"), // 2026-06-06 20:00 IST
    });

    expect(morning).toEqual({ amount: 50, daysOverdue: 1 });
    expect(evening).toEqual({ amount: 50, daysOverdue: 1 });
  });

  it("attributes an early-IST-morning instant to the correct IST day", () => {
    // 2026-06-06T02:00Z is 07:30 IST on the 6th — one day overdue. Under the
    // old UTC day boundary this same instant during the first 5.5h of the IST
    // day could be mis-dated; the IST calendar keeps it on the 6th.
    const result = calculateLateFee({
      ...base(),
      asOf: new Date("2026-06-06T02:00:00.000Z"),
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
