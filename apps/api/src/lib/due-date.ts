export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

/** Parse a YYYY-MM-DD business-calendar value without consulting server TZ. */
export function parseDateOnly(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return new Date(Number.NaN);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatDateOnly(value: Date | string): string {
  const parsed = parseDateOnly(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

/** Today's date in the fixed business timezone, independent of server TZ. */
export function businessDate(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return parseDateOnly(`${part("year")}-${part("month")}-${part("day")}`);
}

/** The configured day (1-28) in the billed calendar month. */
export function computeDueDate(billMonth: string, dueDay = 5): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(billMonth);
  if (!match) throw new Error("Invalid bill month");
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
    throw new Error("dueDay must be an integer from 1 to 28");
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, dueDay));
}

export function isOverdue(dueDate: Date | string | null, now = new Date()): boolean {
  if (!dueDate) return false;
  return parseDateOnly(dueDate).getTime() < businessDate(now).getTime();
}
