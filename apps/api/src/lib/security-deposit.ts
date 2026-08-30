/**
 * How much of a deposit remains unrefunded — the owner's outstanding
 * liability to this one tenant.
 */
export function outstandingLiability(deposit: { amount: number; refundAmount: number }): number {
  return deposit.amount - deposit.refundAmount;
}

export interface RefundInputs {
  deposit: { amount: number; refundAmount: number; status: string };
  requestedAmount: number;
}

export type RefundResult =
  | {
      ok: true;
      newRefundAmount: number;
      newStatus: "partial" | "refunded";
    }
  | { ok: false; reason: "already-refunded" | "invalid-amount" | "exceeds-outstanding" };

/**
 * Decides the effect of issuing a refund against a held deposit.
 *
 * Pure: the caller writes the result inside a transaction; this only decides
 * whether the refund is valid and what the deposit's new status should be, so
 * the partial-vs-fully-refunded boundary is tested without a database.
 */
export function issueRefund(inputs: RefundInputs): RefundResult {
  if (inputs.deposit.status === "refunded") {
    return { ok: false, reason: "already-refunded" };
  }
  if (inputs.requestedAmount <= 0) {
    return { ok: false, reason: "invalid-amount" };
  }

  const outstanding = outstandingLiability(inputs.deposit);
  if (inputs.requestedAmount > outstanding) {
    return { ok: false, reason: "exceeds-outstanding" };
  }

  const newRefundAmount = inputs.deposit.refundAmount + inputs.requestedAmount;

  return {
    ok: true,
    newRefundAmount,
    newStatus: newRefundAmount >= inputs.deposit.amount ? "refunded" : "partial",
  };
}

export interface LiabilityTotals {
  totalHeld: number;
  totalRefunded: number;
  netLiability: number;
}

/**
 * Aggregates the owner's deposit liability across a set of deposits.
 * netLiability is always totalHeld - totalRefunded — the report and the
 * per-deposit numbers can never disagree because this is the only place the
 * subtraction happens.
 */
export function summarizeLiability(
  deposits: Array<{ amount: number; refundAmount: number }>,
): LiabilityTotals {
  const totalHeld = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalRefunded = deposits.reduce((sum, d) => sum + d.refundAmount, 0);

  return { totalHeld, totalRefunded, netLiability: totalHeld - totalRefunded };
}
