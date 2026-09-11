import { Router } from "express";
import type { Request } from "express";
import {
  db,
  user,
  ownerProfile,
  property,
  tenant,
  bill,
  payment,
  room,
  bed,
  staff,
  bedBooking,
} from "@pgkhata/db";
import { eq, or, inArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { contains, escapeLike } from "../../lib/admin-list";

/**
 * `GET /v1/admin/search?q=` — one box, every entity.
 *
 * The job this exists for is a 9pm phone call: an owner says a tenant never got
 * their bill. The agent has a phone number, or an email, or the broken link the
 * owner forwarded. Anything that makes them pick an entity type first, or pick
 * the right owner first, has already lost — so this dispatches on the *shape*
 * of what was typed, and every result carries its owner, which is the one click
 * to Owner 360.
 *
 * Deliberately open to `support`: this IS the support job, so there is no role
 * narrowing here. The root gate in routes/admin/index.ts already requires an
 * active platform admin, and nothing below writes.
 *
 * No role guard is applied with `router.use(...)` either — every admin
 * sub-router is mounted at "/", so router-level middleware runs for requests a
 * *sibling* router handles. That is exactly how `support` once started getting
 * 403 from the impersonation endpoint.
 */

const router = Router();

/** Per entity type, not overall: five owners and five tenants is still scannable. */
const RESULT_LIMIT = 5;

/** Below this a query matches most of the database; scanning for it is pure cost. */
const MIN_QUERY_LENGTH = 2;

/**
 * Long enough for a pasted invoice URL with tracking parameters, short enough
 * that nobody can paste a pathological pattern into an `ILIKE`.
 */
const MAX_QUERY_LENGTH = 512;

/**
 * Re-exported so the query-shape tests can assert the escaping contract against
 * the module under test rather than reaching past it. The implementation stays
 * the single one in lib/admin-list.ts that the five admin lists already use.
 */
export { escapeLike };

// --------------------------------------------------------------------------
// Query classification — pure, exported, and the part worth testing.
// --------------------------------------------------------------------------

export type SearchKind = "empty" | "phone" | "email" | "uuid" | "token" | "text";

export interface ClassifiedQuery {
  kind: SearchKind;
  /**
   * What the branch actually searches with: 10 digits for a phone, the bare
   * token for a token (even when it arrived inside a URL), the trimmed input
   * otherwise.
   */
  value: string;
  /**
   * The trimmed input as typed. `value !== text` means a token was lifted out
   * of something larger, which is how the token branch knows a free-text
   * fallback would be meaningless.
   */
  text: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `tenant.onboardingToken` is `randomBytes(24).toString("base64url")` — 32
 * characters of `[A-Za-z0-9_-]`. The other three public tokens are UUIDs.
 * Note the absence of `.`: it keeps a hostname from being mistaken for a token
 * when a whole URL is split apart.
 */
const OPAQUE_TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

/** Only the characters a human types when they mean a phone number. */
const PHONE_SHAPED_RE = /^[+\d\s().-]+$/;

function looksLikeToken(segment: string): boolean {
  return UUID_RE.test(segment) || OPAQUE_TOKEN_RE.test(segment);
}

/**
 * Pulls the token out of a pasted link. This is the highest-leverage case in
 * the whole feature: the owner forwards the invoice URL that "does not work",
 * the agent pastes the entire thing, and lands on the bill. Making them
 * hand-extract the last path segment first is the difference between two clicks
 * and a support ticket.
 *
 * Scans right-to-left because the token is the deepest part of every public URL
 * we mint (`/invoice/:token`, `/public/signup/:token`, `/public/complaint/:token`,
 * `/onboarding/:token`), so a trailing `?utm=...` or a fragment is stepped over
 * rather than matched.
 *
 * Returns null for anything that is not link-shaped, so a bare token is
 * classified by `classifyQuery` instead and keeps its free-text fallback.
 */
export function extractToken(raw: string): string | null {
  if (!raw.includes("/") && !raw.includes("\\")) return null;

  const segments = raw.split(/[/\\?#&=\s]+/).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i]!;
    if (looksLikeToken(segment)) return segment;
  }
  return null;
}

/**
 * Normalises anything phone-shaped to the 10 national digits, which is the form
 * `tenant.phone` is unique on. Accepts `+91`, a bare `91`, and the leading `0`
 * an Indian dialling habit adds, plus any spacing, dashes, dots or brackets.
 *
 * Returns null rather than guessing when the digit count is not one it
 * recognises: a wrong normalisation would silently search for a different
 * person, which is worse than falling through to free text.
 */
export function extractPhone(raw: string): string | null {
  if (!PHONE_SHAPED_RE.test(raw)) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("091")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  return digits.length === 10 ? digits : null;
}

/**
 * Order matters and is not arbitrary.
 *
 * A link is checked first because a URL can contain digits, an `@` and a UUID
 * all at once, and only the token in it is meaningful. Phone comes next because
 * it is the primary lookup key — `tenant.phone` is globally unique, so a phone
 * resolves to exactly one tenant platform-wide. `@` then settles email. A bare
 * UUID is a primary key or a UUID-shaped token. Anything else long and opaque
 * is treated as a token *with* a free-text fallback, because "sunrisepgkanadia"
 * is also long and opaque and is somebody's property name.
 */
export function classifyQuery(raw: string | undefined | null): ClassifiedQuery {
  const text = (raw ?? "").trim();
  if (text.length < MIN_QUERY_LENGTH || text.length > MAX_QUERY_LENGTH) {
    return { kind: "empty", value: "", text };
  }

  const token = extractToken(text);
  if (token) return { kind: "token", value: token, text };

  const phone = extractPhone(text);
  if (phone) return { kind: "phone", value: phone, text };

  if (text.includes("@")) return { kind: "email", value: text, text };

  if (UUID_RE.test(text)) return { kind: "uuid", value: text, text };

  if (OPAQUE_TOKEN_RE.test(text)) return { kind: "token", value: text, text };

  return { kind: "text", value: text, text };
}

// --------------------------------------------------------------------------
// Result shape
// --------------------------------------------------------------------------

export type SearchResultType =
  | "owner"
  | "property"
  | "tenant"
  | "bill"
  | "payment"
  | "staff"
  | "booking";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  sublabel: string;
  /** Path within the admin app, not a full URL — the app prefixes its own origin. */
  href: string;
  /**
   * `ownerProfile.id`, never null. Every row reachable here hangs off a
   * property and `property.ownerId` is not nullable, so the owner is always
   * knowable — and it is the whole point: one click from any hit to Owner 360.
   */
  ownerId: string;
  ownerName: string;
}

export interface SearchResponse {
  query: string;
  kind: SearchKind;
  results: SearchResult[];
}

function money(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function isoDate(value: Date | string | null): string {
  if (!value) return "—";
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10);
}

/** Joins the non-empty parts of a sublabel with a middot. */
function join(...parts: (string | null | undefined)[]): string {
  return parts.filter((part) => part !== null && part !== undefined && part !== "").join(" · ");
}

// --------------------------------------------------------------------------
// Per-entity probes. Each takes a predicate, so the phone / email / uuid /
// token / text branches compose them instead of restating seven joins.
// --------------------------------------------------------------------------

async function findOwners(where: SQL): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: ownerProfile.id,
      name: user.name,
      email: user.email,
      phone: ownerProfile.phone,
    })
    .from(ownerProfile)
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(where)
    .limit(RESULT_LIMIT);

  return rows.map((row) => ({
    type: "owner" as const,
    id: row.id,
    label: row.name,
    sublabel: join(row.email, row.phone),
    href: `/dashboard/owners/${row.id}`,
    ownerId: row.id,
    ownerName: row.name,
  }));
}

async function findProperties(where: SQL): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: property.id,
      name: property.name,
      code: property.code,
      city: property.city,
      ownerId: ownerProfile.id,
      ownerName: user.name,
    })
    .from(property)
    .innerJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(where)
    .limit(RESULT_LIMIT);

  return rows.map((row) => ({
    type: "property" as const,
    id: row.id,
    label: row.name,
    sublabel: join(row.code, row.city, row.ownerName),
    href: `/dashboard/properties/${row.id}`,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
  }));
}

async function findTenants(where: SQL): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone,
      status: tenant.status,
      propertyName: property.name,
      ownerId: ownerProfile.id,
      ownerName: user.name,
    })
    .from(tenant)
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .innerJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(where)
    .limit(RESULT_LIMIT);

  return rows.map((row) => ({
    type: "tenant" as const,
    id: row.id,
    label: row.name,
    sublabel: join(row.phone, row.propertyName, row.status),
    href: `/dashboard/tenants/${row.id}`,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
  }));
}

async function findBills(where: SQL): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: bill.id,
      billMonth: bill.billMonth,
      totalAmount: bill.totalAmount,
      balance: bill.balance,
      status: bill.status,
      tenantName: tenant.name,
      propertyName: property.name,
      ownerId: ownerProfile.id,
      ownerName: user.name,
    })
    .from(bill)
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .innerJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(where)
    .limit(RESULT_LIMIT);

  return rows.map((row) => ({
    type: "bill" as const,
    id: row.id,
    label: `${row.billMonth} — ${row.tenantName}`,
    sublabel: join(
      money(row.totalAmount),
      `balance ${money(row.balance)}`,
      row.status,
      row.propertyName,
    ),
    href: `/dashboard/billing/${row.id}`,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
  }));
}

async function findPayments(where: SQL): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: payment.id,
      billId: payment.billId,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      method: payment.method,
      billMonth: bill.billMonth,
      tenantName: tenant.name,
      ownerId: ownerProfile.id,
      ownerName: user.name,
    })
    .from(payment)
    .innerJoin(bill, eq(payment.billId, bill.id))
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .innerJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(where)
    .limit(RESULT_LIMIT);

  // A payment has no page of its own; the bill's detail view is where it is
  // shown, and that is also where the agent needs to end up.
  return rows.map((row) => ({
    type: "payment" as const,
    id: row.id,
    label: `${money(row.amount)} — ${row.tenantName}`,
    sublabel: join(isoDate(row.paymentDate), row.method, `bill ${row.billMonth}`),
    href: `/dashboard/billing/${row.billId}`,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
  }));
}

async function findStaff(where: SQL): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: staff.id,
      name: staff.name,
      phone: staff.phone,
      role: staff.role,
      isActive: staff.isActive,
      propertyId: property.id,
      propertyName: property.name,
      ownerId: ownerProfile.id,
      ownerName: user.name,
    })
    .from(staff)
    .innerJoin(property, eq(staff.propertyId, property.id))
    .innerJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(where)
    .limit(RESULT_LIMIT);

  return rows.map((row) => ({
    type: "staff" as const,
    id: row.id,
    label: row.name,
    sublabel: join(row.phone, row.role, row.isActive ? null : "inactive", row.propertyName),
    href: `/dashboard/properties/${row.propertyId}`,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
  }));
}

async function findBookings(where: SQL): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: bedBooking.id,
      tenantName: bedBooking.tenantName,
      tenantPhone: bedBooking.tenantPhone,
      status: bedBooking.status,
      bedNumber: bed.number,
      roomNumber: room.number,
      propertyId: property.id,
      propertyName: property.name,
      ownerId: ownerProfile.id,
      ownerName: user.name,
    })
    .from(bedBooking)
    .innerJoin(bed, eq(bedBooking.bedId, bed.id))
    .innerJoin(room, eq(bed.roomId, room.id))
    .innerJoin(property, eq(room.propertyId, property.id))
    .innerJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(where)
    .limit(RESULT_LIMIT);

  return rows.map((row) => ({
    type: "booking" as const,
    id: row.id,
    label: `${row.tenantName} (booking)`,
    sublabel: join(
      row.tenantPhone,
      `${row.roomNumber}-${row.bedNumber}`,
      row.status,
      row.propertyName,
    ),
    href: `/dashboard/properties/${row.propertyId}`,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
  }));
}

// --------------------------------------------------------------------------
// Branches
// --------------------------------------------------------------------------

type PhonePredicate = (column: AnyPgColumn) => SQL;

/**
 * The formats a 10-digit number is plausibly stored in. Matching these by
 * equality keeps the unique index on `tenant.phone` in play, which is what
 * makes the primary support lookup feel instant.
 */
function phoneCandidates(digits: string): string[] {
  return [digits, `+91${digits}`, `+91 ${digits}`, `+91-${digits}`, `91${digits}`, `0${digits}`];
}

const exactPhone =
  (digits: string): PhonePredicate =>
  (column) =>
    inArray(column, phoneCandidates(digits));

/**
 * Digit-normalised comparison: correct for any stored formatting, but it cannot
 * use the index, so it is only ever the second attempt.
 */
const normalisedPhone =
  (digits: string): PhonePredicate =>
  (column) =>
    sql`right(regexp_replace(${column}, '[^0-9]', '', 'g'), 10) = ${digits}`;

function phoneProbes(match: PhonePredicate): Promise<SearchResult[][]> {
  return Promise.all([
    findTenants(match(tenant.phone)),
    findOwners(match(ownerProfile.phone)),
    findStaff(match(staff.phone)),
    findBookings(match(bedBooking.tenantPhone)),
  ]);
}

/**
 * Two stages, and the second one almost never runs.
 *
 * Stage one is four equality probes against indexed phone columns. If a number
 * was stored with spacing nobody anticipated, that finds nothing — and "no
 * results" for a phone number is precisely the failure this endpoint exists to
 * prevent, so stage two re-asks with a digits-only comparison that cannot miss.
 * Paying for the sequential scan only on a miss keeps the common path indexed.
 */
async function searchByPhone(digits: string): Promise<SearchResult[]> {
  const fast = (await phoneProbes(exactPhone(digits))).flat();
  if (fast.length > 0) return fast;
  return (await phoneProbes(normalisedPhone(digits))).flat();
}

/**
 * Substring rather than equality, so pasting a fragment out of a support thread
 * works and a shared domain (`@sunrisepg.in`) lists the accounts on it.
 *
 * Only users that are owners are surfaced: a platform admin or a staff login is
 * not something support acts on here, and — more to the point — a user with no
 * `owner_profile` has no owner to carry, which would break the contract that
 * every result is one click from Owner 360.
 */
async function searchByEmail(value: string): Promise<SearchResult[]> {
  const [owners, tenants] = await Promise.all([
    findOwners(contains(user.email, value)),
    findTenants(contains(tenant.email, value)),
  ]);
  return [...owners, ...tenants];
}

/**
 * Five probes, all on unique indexes. The bill and property probes fold their
 * public tokens into the same statement with `or`, because `bill.accessToken`,
 * `property.signupToken` and `property.complaintToken` are all UUID-shaped — so
 * a bare UUID pasted out of a link resolves without the agent having to know
 * whether they copied an id or a token.
 */
async function searchByUuid(value: string): Promise<SearchResult[]> {
  const groups = await Promise.all([
    findBills(or(eq(bill.id, value), eq(bill.accessToken, value))!),
    findPayments(eq(payment.id, value)),
    findTenants(eq(tenant.id, value)),
    findProperties(
      or(
        eq(property.id, value),
        eq(property.signupToken, value),
        eq(property.complaintToken, value),
      )!,
    ),
    findOwners(eq(ownerProfile.id, value)),
  ]);
  return groups.flat();
}

/** The four public capability tokens, whether pasted bare or lifted from a URL. */
async function searchByToken(value: string): Promise<SearchResult[]> {
  const groups = await Promise.all([
    findBills(eq(bill.accessToken, value)),
    findProperties(or(eq(property.signupToken, value), eq(property.complaintToken, value))!),
    findTenants(eq(tenant.onboardingToken, value)),
  ]);
  return groups.flat();
}

/** Names and codes. `contains` escapes `%`, `_` and `\` before interpolating. */
async function searchByText(value: string): Promise<SearchResult[]> {
  const groups = await Promise.all([
    findOwners(contains(user.name, value)),
    findProperties(or(contains(property.name, value), contains(property.code, value))!),
    findTenants(contains(tenant.name, value)),
  ]);
  return groups.flat();
}

async function runSearch(classified: ClassifiedQuery): Promise<SearchResult[]> {
  switch (classified.kind) {
    case "empty":
      return [];
    case "phone":
      return searchByPhone(classified.value);
    case "email":
      return searchByEmail(classified.value);
    case "uuid":
      return searchByUuid(classified.value);
    case "token": {
      const hits = await searchByToken(classified.value);
      if (hits.length > 0) return hits;
      // A token lifted out of a URL that matched nothing is a dead link, and
      // free-text searching the URL itself would be noise. A *bare* opaque
      // string that matched nothing is far more likely to have been a property
      // name that merely looked token-shaped, so it gets the free-text pass.
      return classified.value === classified.text ? searchByText(classified.text) : [];
    }
    case "text":
      return searchByText(classified.value);
  }
}

router.get("/search", async (req: Request, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q : "";
  const classified = classifyQuery(raw);

  const response: SearchResponse = {
    query: classified.text,
    kind: classified.kind,
    results: await runSearch(classified),
  };

  res.json(response);
});

export default router;
