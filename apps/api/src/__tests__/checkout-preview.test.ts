import { describe, expect, it } from "vitest";
import { calculateCheckoutPreview } from "../lib/checkout-preview";

describe("calculateCheckoutPreview", () => {
  it("sums outstanding liability across MULTIPLE deposits", () => {
    // Regression: the route previously read only one deposit (.limit(1)), so a
    // tenant with more than one held deposit had the rest ignored.
    const result = calculateCheckoutPreview({
      outstandingBills: [],
      securityDeposits: [
        { amount: 1000, refundAmount: 0, status: "held" },
        { amount: 500, refundAmount: 0, status: "held" },
      ],
      advancePayments: [],
    });

    expect(result.depositHeld).toBe(1500);
    expect(result.netSettlement).toBe(1500);
  });

  it("counts a partially refunded deposit's remaining balance and ignores a fully refunded one", () => {
    const result = calculateCheckoutPreview({
      outstandingBills: [],
      securityDeposits: [
        { amount: 1000, refundAmount: 400, status: "partial" },
        { amount: 800, refundAmount: 800, status: "refunded" },
      ],
      advancePayments: [],
    });

    // 600 remaining on the first, 0 on the fully refunded second.
    expect(result.depositHeld).toBe(600);
  });

  it("nets deposits and advances against outstanding bills", () => {
    const result = calculateCheckoutPreview({
      outstandingBills: [
        { totalAmount: 5000, paidAmount: 3000, balance: 2000 },
      ],
      securityDeposits: [{ amount: 1000, refundAmount: 0, status: "held" }],
      advancePayments: [{ amount: 500, appliedAmount: 0, status: "available" }],
    });

    expect(result.totalOutstanding).toBe(2000);
    expect(result.depositHeld).toBe(1000);
    expect(result.advanceBalance).toBe(500);
    // 1000 + 500 - 2000 = -500 (tenant owes the owner)
    expect(result.netSettlement).toBe(-500);
    expect(result.depositToRefund).toBe(0);
  });

  it("returns zero deposit held when the tenant has no deposits", () => {
    const result = calculateCheckoutPreview({
      outstandingBills: [],
      securityDeposits: [],
      advancePayments: [],
    });

    expect(result.depositHeld).toBe(0);
    expect(result.netSettlement).toBe(0);
  });
});
