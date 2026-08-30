import { describe, expect, it } from "vitest";
import { outstandingLiability, issueRefund, summarizeLiability } from "../lib/security-deposit";

describe("outstandingLiability", () => {
  it("is the full amount before any refund", () => {
    expect(outstandingLiability({ amount: 10000, refundAmount: 0 })).toBe(10000);
  });

  it("shrinks as refunds are issued", () => {
    expect(outstandingLiability({ amount: 10000, refundAmount: 4000 })).toBe(6000);
  });

  it("is zero once fully refunded", () => {
    expect(outstandingLiability({ amount: 10000, refundAmount: 10000 })).toBe(0);
  });
});

describe("issueRefund", () => {
  function deposit(amount: number, refundAmount = 0, status = "held") {
    return { amount, refundAmount, status };
  }

  it("issues a partial refund and leaves the deposit partial", () => {
    const result = issueRefund({ deposit: deposit(10000), requestedAmount: 4000 });

    expect(result).toEqual({ ok: true, newRefundAmount: 4000, newStatus: "partial" });
  });

  it("marks the deposit refunded once the full amount is returned", () => {
    const result = issueRefund({ deposit: deposit(10000), requestedAmount: 10000 });

    expect(result).toEqual({ ok: true, newRefundAmount: 10000, newStatus: "refunded" });
  });

  it("marks refunded when a second partial refund completes the amount", () => {
    const result = issueRefund({ deposit: deposit(10000, 6000), requestedAmount: 4000 });

    expect(result).toEqual({ ok: true, newRefundAmount: 10000, newStatus: "refunded" });
  });

  it("keeps the deposit partial when a further refund does not yet complete it", () => {
    const result = issueRefund({ deposit: deposit(10000, 3000), requestedAmount: 3000 });

    expect(result).toEqual({ ok: true, newRefundAmount: 6000, newStatus: "partial" });
  });

  it("refuses a refund exceeding what remains outstanding", () => {
    const result = issueRefund({ deposit: deposit(10000, 6000), requestedAmount: 5000 });

    expect(result).toEqual({ ok: false, reason: "exceeds-outstanding" });
  });

  it("refuses a refund on an already fully refunded deposit", () => {
    const result = issueRefund({
      deposit: deposit(10000, 10000, "refunded"),
      requestedAmount: 1,
    });

    expect(result).toEqual({ ok: false, reason: "already-refunded" });
  });

  it("refuses a zero or negative refund amount", () => {
    expect(issueRefund({ deposit: deposit(10000), requestedAmount: 0 })).toEqual({
      ok: false,
      reason: "invalid-amount",
    });
    expect(issueRefund({ deposit: deposit(10000), requestedAmount: -500 })).toEqual({
      ok: false,
      reason: "invalid-amount",
    });
  });

  it("allows a refund exactly equal to the outstanding balance", () => {
    const result = issueRefund({ deposit: deposit(10000, 7000), requestedAmount: 3000 });

    expect(result.ok).toBe(true);
  });
});

describe("summarizeLiability", () => {
  it("reconciles net liability as held minus refunded across every deposit", () => {
    const deposits = [
      { amount: 10000, refundAmount: 0 },
      { amount: 8000, refundAmount: 8000 },
      { amount: 12000, refundAmount: 5000 },
    ];

    const result = summarizeLiability(deposits);

    expect(result).toEqual({ totalHeld: 30000, totalRefunded: 13000, netLiability: 17000 });
  });

  it("reports zeroes for no deposits", () => {
    expect(summarizeLiability([])).toEqual({
      totalHeld: 0,
      totalRefunded: 0,
      netLiability: 0,
    });
  });

  it("reports zero net liability once everything is refunded", () => {
    const deposits = [
      { amount: 5000, refundAmount: 5000 },
      { amount: 3000, refundAmount: 3000 },
    ];

    expect(summarizeLiability(deposits).netLiability).toBe(0);
  });
});
