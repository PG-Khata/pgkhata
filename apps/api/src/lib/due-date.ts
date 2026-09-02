/**
 * Gives a newly issued invoice a predictable payment window. A due date
 * must never precede its issue date, even when an owner generates a bill
 * after the rent-plan's historical calendar due day has passed.
 */
export function computeDueDate(issueDate: Date, daysAfterIssue = 5): Date {
  const dueDate = new Date(issueDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + daysAfterIssue);
  return dueDate;
}
