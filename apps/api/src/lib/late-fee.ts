/**
 * Computes the late fee for a bill as of a given date.
 *
 * Overdue is counted from the day *after* the due date: a bill due on the
 * 5th is not late on the 5th itself, only from the 6th. Day 1 overdue is the
 * first billable day, so `daysOverdue * lateFeePerDay` charges for full days
 * elapsed, not the due date itself.
 *
 * Pure — no database access, no side effects, no idempotency concern here:
 * the caller decides how to apply and whether a fee already exists.
 */
export interface LateFeeInputs {
  dueDate: Date | string | null;
  lateFeePerDay: number | null | undefined;
  asOf: Date;
  /** Already-settled bills never accrue a late fee, however overdue they are. */
  balance: number;
  /** A voided bill is not owed at all. */
  voidedAt: Date | string | null | undefined;
}

export interface LateFeeResult {
  amount: number;
  daysOverdue: number;
}

export function calculateLateFee(inputs: LateFeeInputs): LateFeeResult {
  if (!inputs.dueDate || !inputs.lateFeePerDay || inputs.lateFeePerDay <= 0) {
    return { amount: 0, daysOverdue: 0 };
  }
  if (inputs.balance <= 0 || inputs.voidedAt) {
    return { amount: 0, daysOverdue: 0 };
  }

  const due = startOfDay(inputs.dueDate);
  const asOf = startOfDay(inputs.asOf);

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysOverdue = Math.floor((asOf.getTime() - due.getTime()) / msPerDay);

  if (daysOverdue <= 0) {
    return { amount: 0, daysOverdue: 0 };
  }

  return { amount: daysOverdue * inputs.lateFeePerDay, daysOverdue };
}

function startOfDay(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
