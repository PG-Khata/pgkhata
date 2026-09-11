import type { DeliveryRow } from "@/hooks/use-admin-comms";

/**
 * Failures are grouped by the *shape* of the error, not by its literal text.
 *
 * A Meta template rejection produces one message per recipient:
 *
 *   "Template pgkhata_bill_v3 is not approved for +919812345678"
 *   "Template pgkhata_bill_v3 is not approved for +919812345679"
 *
 * Grouped on the raw string that is 400 distinct incidents; grouped on the
 * redacted string it is what it actually is — one incident with 400 victims.
 * So recipients and ids are replaced with placeholders before grouping, and
 * one untouched message is kept alongside as `sample` so the literal text is
 * never lost.
 *
 * Order matters: emails before phone numbers before bare digit runs, otherwise
 * the digits inside a phone number are eaten first and the phone pattern never
 * matches.
 */
const EMAIL = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>,;]+/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/**
 * A long alphanumeric run containing at least one digit — a provider message
 * id, not a word. The digit requirement matters: without it a legitimate long
 * word in an error message ("recipientunreachable") would be redacted into
 * `<id>` and the group heading would stop being readable.
 */
const LONG_ID = /\b(?=[0-9a-z]*\d)[0-9a-z]{16,}\b/gi;
const DIGITS = /\b\d{4,}\b/g;

export const NO_ERROR_TEXT = "(no error message recorded)";

export function redactError(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return NO_ERROR_TEXT;
  return trimmed
    .replace(EMAIL, "<recipient>")
    .replace(UUID, "<id>")
    .replace(PHONE, "<recipient>")
    .replace(LONG_ID, "<id>")
    .replace(DIGITS, "<n>");
}

export interface FailureGroup {
  /** The redacted error, used as both React key and group heading. */
  pattern: string;
  /** One real, unredacted message, so the literal provider text stays visible. */
  sample: string | null;
  count: number;
  /** Channel name to number of failures, e.g. `{ whatsapp: 400 }`. */
  channels: Record<string, number>;
  templates: string[];
  kinds: string[];
  firstAt: string;
  lastAt: string;
  rows: DeliveryRow[];
}

/**
 * Groups a sample of failed deliveries by redacted error string, biggest blast
 * radius first. Ties break on recency, because two groups of three are read in
 * the order they happened.
 */
export function groupFailures(rows: DeliveryRow[]): FailureGroup[] {
  const byPattern = new Map<string, FailureGroup>();

  for (const row of rows) {
    const pattern = redactError(row.error);
    let group = byPattern.get(pattern);

    if (!group) {
      group = {
        pattern,
        sample: row.error?.trim() || null,
        count: 0,
        channels: {},
        templates: [],
        kinds: [],
        firstAt: row.createdAt,
        lastAt: row.createdAt,
        rows: [],
      };
      byPattern.set(pattern, group);
    }

    group.count += 1;
    group.rows.push(row);
    group.channels[row.channel] = (group.channels[row.channel] ?? 0) + 1;
    if (row.template && !group.templates.includes(row.template)) group.templates.push(row.template);
    if (row.kind && !group.kinds.includes(row.kind)) group.kinds.push(row.kind);
    if (row.createdAt < group.firstAt) group.firstAt = row.createdAt;
    if (row.createdAt > group.lastAt) group.lastAt = row.createdAt;
    if (!group.sample && row.error?.trim()) group.sample = row.error.trim();
  }

  return Array.from(byPattern.values()).sort(
    (a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt),
  );
}
