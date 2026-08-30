/**
 * How much of an advance can still be applied.
 * amount and appliedAmount are both non-negative and appliedAmount <= amount
 * at the database (CHECK advance_payment_applied_within_amount); this mirrors
 * that invariant for the pure decision layer.
 */
export function availableBalance(advance: { amount: number; appliedAmount: number }): number {
  return advance.amount - advance.appliedAmount;
}

export interface ApplyAdvanceInputs {
  advance: { amount: number; appliedAmount: number; status: string };
  /** The bill's current outstanding balance, before this application. */
  billBalance: number;
  /** How much of the advance to apply; if omitted, applies as much as fits. */
  requestedAmount?: number;
}

export type ApplyAdvanceResult =
  | {
      ok: true;
      /** Rupees actually moved from the advance onto the bill. */
      amountApplied: number;
      newAppliedAmount: number;
      newAdvanceStatus: "available" | "applied";
      newBillBalance: number;
    }
  | { ok: false; reason: "forfeited" | "nothing-available" | "exceeds-available" | "exceeds-bill-balance" };

/**
 * Decides how an advance application affects both the advance and the bill.
 *
 * Pure: the caller performs the actual writes inside a transaction; this
 * function only decides whether the application is valid and what the
 * resulting numbers should be, so every rule is tested without a database.
 */
export function applyAdvanceToBill(inputs: ApplyAdvanceInputs): ApplyAdvanceResult {
  if (inputs.advance.status === "forfeited") {
    return { ok: false, reason: "forfeited" };
  }

  const available = availableBalance(inputs.advance);
  if (available <= 0) {
    return { ok: false, reason: "nothing-available" };
  }

  const requested = inputs.requestedAmount ?? Math.min(available, inputs.billBalance);

  if (requested > available) {
    return { ok: false, reason: "exceeds-available" };
  }
  if (requested > inputs.billBalance) {
    return { ok: false, reason: "exceeds-bill-balance" };
  }
  if (requested <= 0) {
    return { ok: false, reason: "nothing-available" };
  }

  const newAppliedAmount = inputs.advance.appliedAmount + requested;

  return {
    ok: true,
    amountApplied: requested,
    newAppliedAmount,
    newAdvanceStatus: newAppliedAmount >= inputs.advance.amount ? "applied" : "available",
    newBillBalance: inputs.billBalance - requested,
  };
}
