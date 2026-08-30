import { describe, expect, it } from "vitest";
import { availableBalance, applyAdvanceToBill } from "../lib/advance-payment";

describe("availableBalance", () => {
  it("is the full amount when nothing has been applied", () => {
    expect(availableBalance({ amount: 5000, appliedAmount: 0 })).toBe(5000);
  });

  it("shrinks as amounts are applied", () => {
    expect(availableBalance({ amount: 5000, appliedAmount: 3000 })).toBe(2000);
  });

  it("is zero once fully applied", () => {
    expect(availableBalance({ amount: 5000, appliedAmount: 5000 })).toBe(0);
  });
});

describe("applyAdvanceToBill", () => {
  function advance(amount: number, appliedAmount = 0, status = "available") {
    return { amount, appliedAmount, status };
  }

  it("applies the smaller of available balance and bill balance by default", () => {
    const result = applyAdvanceToBill({
      advance: advance(5000),
      billBalance: 3000,
    });

    expect(result).toEqual({
      ok: true,
      amountApplied: 3000,
      newAppliedAmount: 3000,
      newAdvanceStatus: "available",
      newBillBalance: 0,
    });
  });

  it("applies the full advance when the bill balance is larger", () => {
    const result = applyAdvanceToBill({
      advance: advance(2000),
      billBalance: 6000,
    });

    expect(result).toEqual({
      ok: true,
      amountApplied: 2000,
      newAppliedAmount: 2000,
      newAdvanceStatus: "applied",
      newBillBalance: 4000,
    });
  });

  it("marks the advance applied once fully consumed, available otherwise", () => {
    const partial = applyAdvanceToBill({ advance: advance(5000, 4000), billBalance: 500 });
    expect(partial.ok && partial.newAdvanceStatus).toBe("available");

    const full = applyAdvanceToBill({ advance: advance(5000, 4000), billBalance: 1000 });
    expect(full.ok && full.newAdvanceStatus).toBe("applied");
  });

  it("refuses to apply more than the requested amount allows", () => {
    const result = applyAdvanceToBill({
      advance: advance(5000),
      billBalance: 6000,
      requestedAmount: 6000,
    });

    expect(result).toEqual({ ok: false, reason: "exceeds-available" });
  });

  it("refuses to apply more than the bill's outstanding balance", () => {
    const result = applyAdvanceToBill({
      advance: advance(5000),
      billBalance: 1000,
      requestedAmount: 3000,
    });

    expect(result).toEqual({ ok: false, reason: "exceeds-bill-balance" });
  });

  it("refuses a forfeited advance regardless of remaining balance", () => {
    const result = applyAdvanceToBill({
      advance: advance(5000, 0, "forfeited"),
      billBalance: 3000,
    });

    expect(result).toEqual({ ok: false, reason: "forfeited" });
  });

  it("refuses an advance that has nothing left available", () => {
    const result = applyAdvanceToBill({
      advance: advance(5000, 5000),
      billBalance: 3000,
    });

    expect(result).toEqual({ ok: false, reason: "nothing-available" });
  });

  it("refuses application to an already-settled bill", () => {
    const result = applyAdvanceToBill({
      advance: advance(5000),
      billBalance: 0,
    });

    expect(result.ok).toBe(false);
  });

  it("supports applying a partial amount smaller than either limit", () => {
    const result = applyAdvanceToBill({
      advance: advance(5000),
      billBalance: 6000,
      requestedAmount: 1500,
    });

    expect(result).toEqual({
      ok: true,
      amountApplied: 1500,
      newAppliedAmount: 1500,
      newAdvanceStatus: "available",
      newBillBalance: 4500,
    });
  });
});
