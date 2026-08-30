/**
 * Computes the due date for a bill from its month and the plan's due day.
 *
 * "2026-05" + due_day 5 -> 2026-05-05. due_day is already constrained to 1-28
 * at the database, so it exists in every month regardless of length — no
 * February 30th to clamp.
 */
export function computeDueDate(billMonth: string, dueDay: number): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(billMonth);
  if (!match) {
    throw new Error(`billMonth must be YYYY-MM, got ${billMonth}`);
  }

  const [, yearStr, monthStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);

  // UTC to avoid the server's local time zone shifting the date across
  // midnight, which would silently move a due date into the wrong day.
  return new Date(Date.UTC(year, month - 1, dueDay));
}
