/**
 * Masking for the government identifiers we store in plaintext.
 *
 * `tenant.aadhaar_number` and `tenant.pan_number` are `text` columns with no
 * encryption (packages/db/src/schema.ts). Owners need the real value — they are
 * the ones filing police verification — but the platform support console does
 * not: an agent on a call needs to confirm "the Aadhaar ending 9012", never the
 * other eight digits. Masking at the edge means a leaked admin session, a
 * screenshot in a ticket, or an over-broad `select()` costs four digits instead
 * of a full national ID.
 *
 * This is a presentation control, not encryption. It does not protect the
 * database; it shrinks what the admin HTTP surface can hand out.
 */

/** Digits kept in the clear. The UIDAI's own "masked Aadhaar" shows four. */
const VISIBLE_SUFFIX = 4;

/**
 * Below this length, revealing the last four would expose most of the value, so
 * nothing is revealed. A real Aadhaar is 12 digits and a real PAN is 10, so no
 * well-formed identifier is ever fully masked — only junk, truncated, or
 * partially-entered data is, which is exactly the data whose shape we cannot
 * reason about.
 */
const MIN_LENGTH_TO_REVEAL = 8;

const MASK_CHAR = "X";

/**
 * `null` in, `null` out — an absent identifier must stay absent rather than
 * become a string of X's that reads like "we hold one".
 *
 * Whitespace-only and empty values are normalised to `null` for the same
 * reason. Everything else keeps its original length so the UI can render a
 * fixed-width field, and so `XXXXXXXX9012` is visibly a 12-digit Aadhaar.
 */
export function maskIdNumber(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.length < MIN_LENGTH_TO_REVEAL) {
    return MASK_CHAR.repeat(trimmed.length);
  }

  return MASK_CHAR.repeat(trimmed.length - VISIBLE_SUFFIX) + trimmed.slice(-VISIBLE_SUFFIX);
}

/**
 * Property names that hold a government identifier anywhere in an admin
 * response. Kept as a set rather than a per-route list because the failure mode
 * being defended against is someone adding a column and forgetting a call site.
 */
const PII_KEYS = new Set(["aadhaarNumber", "panNumber"]);

function scrub(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  // Dates (and any other class instance) must survive intact: rebuilding one
  // from its entries would turn a `Date` into `{}` in the JSON body.
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(scrub);
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = PII_KEYS.has(key)
      ? maskIdNumber(typeof child === "string" ? child : null)
      : scrub(child);
  }
  return out;
}

/**
 * Masks every Aadhaar/PAN reachable in a response body, at any depth.
 *
 * Applied as the last step before `res.json` in routes/admin/tenants.ts, so the
 * guarantee is a property of the router rather than of each handler: a route
 * added next month that selects the raw column still cannot serve it, and
 * `admin-hardening.test.ts` asserts every response in that file goes through
 * here.
 *
 * The return type is deliberately `T`. The masked value has the same
 * `string | null` shape as the column, so callers keep their row types and
 * nothing downstream has to know masking happened.
 */
export function scrubPii<T>(value: T): T {
  return scrub(value) as T;
}
