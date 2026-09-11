import { Router, type Request, type Response } from "express";
import { db, user, ownerProfile, property, room, bed, tenant, bill, payment } from "@pgkhata/db";
import { and, eq, gte, inArray, isNull, lt, ne, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { aggregate } from "../../lib/http";
import { buildMonthlyTrend } from "../../lib/dashboard-analytics";

/**
 * Platform metrics. Guarded by the root gate in ./index.ts — do not add a
 * `router.use(...)` here: every admin sub-router is mounted at "/", so
 * router-level middleware runs for requests a sibling router handles. That
 * exact mistake made `support` admins get 403 from the impersonation endpoint.
 * Every route below is a GET open to either admin role; a narrower role guard,
 * if one is ever needed, goes on the individual route.
 */
const router = Router();

// ===========================================================================
// Calendar: Asia/Kolkata, never UTC
// ===========================================================================

/**
 * PGKhata is an India-only product, so every month boundary here is the
 * Asia/Kolkata civil calendar. Under UTC bucketing the first 5h30m of every IST
 * day files under the previous day — a payment entered at 02:00 IST on the 1st
 * would be counted in the month that just closed, which is precisely the window
 * in which owners catch up on the previous month's cash. India has a fixed
 * +05:30 offset and has never observed DST, so this is pure arithmetic and
 * needs no tz database at runtime.
 *
 * Two kinds of column are involved and they are treated differently on purpose:
 *
 *   - `timestamptz` (every `created_at`): an absolute instant. Converted with
 *     `AT TIME ZONE 'Asia/Kolkata'` when deriving a month label, and bounded by
 *     instants computed from IST wall-clock month starts.
 *   - `date` (`payment.payment_date`, `tenant.joining_date`) and the `text`
 *     `bill.bill_month`: already the business calendar, carrying no zone at
 *     all. These are compared as-is; converting them would be a second,
 *     spurious shift.
 */
const TIMEZONE = "Asia/Kolkata" as const;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const MS_PER_DAY = 86_400_000;

/** `YYYY-MM` for an instant, read in the IST calendar. */
function istMonthKey(at: Date): string {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A Date whose *local* calendar fields are the current IST wall clock.
 *
 * `buildMonthlyTrend` walks months with `getFullYear()`/`getMonth()`, which
 * read the process's local zone — and the server is not in India. Handing it
 * this value makes its month walk an IST one without changing the function.
 * Noon, so no server offset can slide it onto the neighbouring day.
 */
function istCalendarNow(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 12);
}

/** `YYYY-MM` shifted by whole months, wrapping years. */
function shiftMonth(month: string, months: number): string {
  const [year, index] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year ?? 1970, (index ?? 1) - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The absolute instant at which `YYYY-MM` begins in IST. */
function istMonthStart(month: string): Date {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (index ?? 1) - 1, 1) - IST_OFFSET_MS);
}

export interface MonthWindow {
  /** Ordered `YYYY-MM` keys, oldest first, gaps included. */
  months: string[];
  firstMonth: string;
  lastMonth: string;
  /** Exclusive upper bound as a month key, for `bill.bill_month` comparisons. */
  monthAfterLast: string;
  /** Inclusive lower bound as an instant, for `timestamptz` columns. */
  startAt: Date;
  /** Exclusive upper bound as an instant, for `timestamptz` columns. */
  endAt: Date;
  /** Inclusive lower bound as `YYYY-MM-DD`, for `date` columns. */
  firstDay: string;
  /** Exclusive upper bound as `YYYY-MM-DD`, for `date` columns. */
  dayAfterLast: string;
}

/**
 * The last `count` IST calendar months, plus every bound a range predicate
 * needs. The month walk itself is delegated to `buildMonthlyTrend`, which
 * already owns "the last N calendar months including the current one, gaps
 * filled" and is unit-tested for it — reimplementing it here would be a second
 * definition of the same calendar.
 */
export function monthWindow(count: number, asOf: Date = istCalendarNow()): MonthWindow {
  const months = buildMonthlyTrend([], count, asOf).map((row) => row.month);
  const firstMonth = months[0]!;
  const lastMonth = months[months.length - 1]!;
  const monthAfterLast = shiftMonth(lastMonth, 1);

  return {
    months,
    firstMonth,
    lastMonth,
    monthAfterLast,
    startAt: istMonthStart(firstMonth),
    endAt: istMonthStart(monthAfterLast),
    firstDay: `${firstMonth}-01`,
    dayAfterLast: `${monthAfterLast}-01`,
  };
}

// ===========================================================================
// SQL building blocks
// ===========================================================================

const COUNT_INT = sql<number>`count(*)::int`;

/**
 * `sum()` over `int4` already returns `bigint`, and these sums are
 * platform-wide rather than per-owner, so `::int` would put a ~₹2.1bn ceiling
 * on the whole platform's volume and fail the query outright on the day it is
 * crossed. The node driver hands `bigint` back as a string, so every read of
 * one of these goes through `num()`.
 */
const moneySum = (column: AnyPgColumn) => sql<string>`coalesce(sum(${column}), 0)::bigint`;

function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The month label for a `timestamptz`, in IST.
 *
 * This appears only in SELECT and GROUP BY — never in a WHERE. Wrapping the
 * filtered column in `to_char()` is what made the old trends endpoint unable to
 * use any index on `created_at`; the filters below are all bare range
 * predicates against the column itself.
 */
const istMonthOf = (column: AnyPgColumn) =>
  sql<string>`to_char(${column} at time zone 'Asia/Kolkata', 'YYYY-MM')`;

/** The month label for a calendar `date`. A date carries no zone to convert. */
const monthOfDate = (column: AnyPgColumn) => sql<string>`to_char(${column}, 'YYYY-MM')`;

/**
 * `inArray(col, [])` renders as `in ()`, which Postgres rejects as a syntax
 * error rather than matching nothing — and "this owner has nothing yet" is the
 * common case on an analytics screen, not the rare one. A constant-false WHERE
 * keeps every branch shaped the same; Postgres turns it into a one-time filter
 * and never touches the table.
 */
function inSet(column: AnyPgColumn, values: string[]): SQL {
  return values.length > 0 ? inArray(column, values) : sql`false`;
}

/** Soft-deleted owners are not part of any platform figure. */
const LIVE_OWNER = ne(ownerProfile.status, "deleted");

/**
 * A tenant row only counts once an owner has accepted it. `pending` is an
 * unapproved public signup and `rejected` never became a tenancy; counting
 * either would inflate every tenant series with rows the owner never saw.
 */
const COUNTED_TENANT_STATUSES = ["active", "vacated"];

/**
 * Voided bills are excluded from every money figure. The
 * `bill_balance_consistent` CHECK exempts voided rows, so a voided bill may
 * carry a positive `balance` and a `paid_amount` that exceeds `total_amount`;
 * summing them over-reports both outstanding and collected.
 */
const LIVE_BILL = isNull(bill.voidedAt);

// ---------------------------------------------------------------------------
// Exported query builders.
//
// Each one is the single definition of a figure, used by the route below and
// asserted on — via `.toSQL()`, with no database — by admin-metrics.test.ts.
// ---------------------------------------------------------------------------

/** New owner accounts per IST month. Per-month, not cumulative. */
export function ownersCreatedPerMonth(window: MonthWindow) {
  const month = istMonthOf(ownerProfile.createdAt);
  return db
    .select({ month, count: COUNT_INT })
    .from(ownerProfile)
    .where(
      and(
        gte(ownerProfile.createdAt, window.startAt),
        lt(ownerProfile.createdAt, window.endAt),
        LIVE_OWNER,
      ),
    )
    .groupBy(month);
}

/** Owner accounts that already existed when the window opened. */
export function ownersBeforeWindow(window: MonthWindow) {
  return db
    .select({ count: COUNT_INT })
    .from(ownerProfile)
    .where(and(lt(ownerProfile.createdAt, window.startAt), LIVE_OWNER));
}

export function propertiesCreatedPerMonth(window: MonthWindow) {
  const month = istMonthOf(property.createdAt);
  return db
    .select({ month, count: COUNT_INT })
    .from(property)
    .where(and(gte(property.createdAt, window.startAt), lt(property.createdAt, window.endAt)))
    .groupBy(month);
}

export function propertiesBeforeWindow(window: MonthWindow) {
  return db
    .select({ count: COUNT_INT })
    .from(property)
    .where(lt(property.createdAt, window.startAt));
}

/** Tenancies that began in each month, by joining date (a calendar `date`). */
export function tenantsJoinedPerMonth(window: MonthWindow) {
  const month = monthOfDate(tenant.joiningDate);
  return db
    .select({ month, count: COUNT_INT })
    .from(tenant)
    .where(
      and(
        sql`${tenant.joiningDate} >= ${window.firstDay}::date`,
        sql`${tenant.joiningDate} < ${window.dayAfterLast}::date`,
        inSet(tenant.status, COUNTED_TENANT_STATUSES),
      ),
    )
    .groupBy(month);
}

/** Tenancies that ended in each month; the negative half of the running total. */
export function tenantsVacatedPerMonth(window: MonthWindow) {
  const month = monthOfDate(tenant.vacatingDate);
  return db
    .select({ month, count: COUNT_INT })
    .from(tenant)
    .where(
      and(
        sql`${tenant.vacatingDate} >= ${window.firstDay}::date`,
        sql`${tenant.vacatingDate} < ${window.dayAfterLast}::date`,
        inSet(tenant.status, COUNTED_TENANT_STATUSES),
      ),
    )
    .groupBy(month);
}

/** Tenancies already open when the window opened — the running total's seed. */
export function activeTenantsBeforeWindow(window: MonthWindow) {
  return db
    .select({ count: COUNT_INT })
    .from(tenant)
    .where(
      and(
        sql`${tenant.joiningDate} < ${window.firstDay}::date`,
        sql`(${tenant.vacatingDate} is null or ${tenant.vacatingDate} >= ${window.firstDay}::date)`,
        inSet(tenant.status, COUNTED_TENANT_STATUSES),
      ),
    );
}

/**
 * Billed and still-open per business month, off `bill.bill_month`.
 *
 * `bill_month` is already `YYYY-MM` text, so the filter is a plain lexicographic
 * range — chronological because the format is fixed width — and no function
 * touches the filtered column.
 */
export function billedPerMonth(window: MonthWindow) {
  return db
    .select({
      month: bill.billMonth,
      billed: moneySum(bill.totalAmount),
      outstanding: moneySum(bill.balance),
      billCount: COUNT_INT,
    })
    .from(bill)
    .where(
      and(gte(bill.billMonth, window.firstMonth), lt(bill.billMonth, window.monthAfterLast), LIVE_BILL),
    )
    .groupBy(bill.billMonth);
}

/**
 * Cash collected per month, from the payment ledger.
 *
 * NOT `sum(bill.paid_amount)`: that is a *current* column. Filtering it by the
 * bill's month attributes a payment recorded today to whichever month the bill
 * belongs to, so every past month silently inflates as old bills get settled.
 * PG owners back-date offline cash constantly, which makes `payment.amount`
 * grouped by `payment.payment_date` the only source that reports a month the
 * same way twice.
 */
export function collectedPerMonth(window: MonthWindow) {
  const month = monthOfDate(payment.paymentDate);
  return db
    .select({ month, collected: moneySum(payment.amount), paymentCount: COUNT_INT })
    .from(payment)
    .innerJoin(bill, eq(payment.billId, bill.id))
    .where(
      and(
        sql`${payment.paymentDate} >= ${window.firstDay}::date`,
        sql`${payment.paymentDate} < ${window.dayAfterLast}::date`,
        LIVE_BILL,
      ),
    )
    .groupBy(month);
}

/** Owner signups and their verification state, per IST month. */
export function signupsPerMonth(window: MonthWindow) {
  const month = istMonthOf(user.createdAt);
  return db
    .select({
      month,
      signups: COUNT_INT,
      verified: sql<number>`count(*) filter (where ${user.emailVerified})::int`,
    })
    .from(ownerProfile)
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(and(gte(user.createdAt, window.startAt), lt(user.createdAt, window.endAt), LIVE_OWNER))
    .groupBy(month);
}

/** Of the owners who signed up in each month, how many have ever billed. */
export function activatedPerSignupMonth(window: MonthWindow) {
  const month = istMonthOf(user.createdAt);
  return db
    .select({ month, activated: sql<number>`count(distinct ${ownerProfile.id})::int` })
    .from(ownerProfile)
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .innerJoin(property, eq(property.ownerId, ownerProfile.id))
    .innerJoin(tenant, eq(tenant.propertyId, property.id))
    .innerJoin(bill, and(eq(bill.tenantId, tenant.id), LIVE_BILL))
    .where(and(gte(user.createdAt, window.startAt), lt(user.createdAt, window.endAt), LIVE_OWNER))
    .groupBy(month);
}

/**
 * Owners who raised a bill in a window. `bill.created_at` — when the row was
 * written — not `bill_month`, because this measures use of the product.
 */
export function ownersBillingBetween(from: Date, to: Date) {
  return db
    .selectDistinct({ ownerId: property.ownerId })
    .from(bill)
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(and(gte(bill.createdAt, from), lt(bill.createdAt, to), LIVE_BILL));
}

/**
 * Owners who recorded a payment in a window. `payment.created_at`, again:
 * `payment_date` is the owner-supplied business date and is routinely
 * back-dated, so it answers "when was the cash taken", not "were they here".
 */
export function ownersRecordingPaymentsBetween(from: Date, to: Date) {
  return db
    .selectDistinct({ ownerId: property.ownerId })
    .from(payment)
    .innerJoin(bill, eq(payment.billId, bill.id))
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(and(gte(payment.createdAt, from), lt(payment.createdAt, to)));
}

/** Every live owner with the two facts the funnel starts from. */
export function ownerSignupRows() {
  return db
    .select({
      ownerId: ownerProfile.id,
      signupAt: user.createdAt,
      emailVerified: user.emailVerified,
    })
    .from(ownerProfile)
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(LIVE_OWNER);
}

export function firstPropertyPerOwner() {
  return db
    .select({ ownerId: property.ownerId, at: sql<Date | null>`min(${property.createdAt})` })
    .from(property)
    .groupBy(property.ownerId);
}

/**
 * Bed creation, reached through `room.property_id -> property.owner_id`.
 * This is the structural milestone: a property with rooms but no beds cannot
 * take a tenant, so it is where owners actually stall.
 */
export function firstBedPerOwner() {
  return db
    .select({ ownerId: property.ownerId, at: sql<Date | null>`min(${bed.createdAt})` })
    .from(bed)
    .innerJoin(room, eq(bed.roomId, room.id))
    .innerJoin(property, eq(room.propertyId, property.id))
    .groupBy(property.ownerId);
}

export function firstTenantPerOwner() {
  return db
    .select({ ownerId: property.ownerId, at: sql<Date | null>`min(${tenant.createdAt})` })
    .from(tenant)
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .groupBy(property.ownerId);
}

export function firstBillPerOwner() {
  return db
    .select({ ownerId: property.ownerId, at: sql<Date | null>`min(${bill.createdAt})` })
    .from(bill)
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(LIVE_BILL)
    .groupBy(property.ownerId);
}

export function firstPaymentPerOwner() {
  return db
    .select({ ownerId: property.ownerId, at: sql<Date | null>`min(${payment.createdAt})` })
    .from(payment)
    .innerJoin(bill, eq(payment.billId, bill.id))
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(LIVE_BILL)
    .groupBy(property.ownerId);
}

/** Signup month per owner, for the retention cohorts. */
export function ownerCohorts(window: MonthWindow) {
  return db
    .select({ ownerId: ownerProfile.id, cohort: istMonthOf(user.createdAt) })
    .from(ownerProfile)
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(and(gte(user.createdAt, window.startAt), lt(user.createdAt, window.endAt), LIVE_OWNER));
}

/** Which IST months each owner generated at least one bill in. */
export function billingMonthsPerOwner(window: MonthWindow) {
  const month = istMonthOf(bill.createdAt);
  return db
    .select({ ownerId: property.ownerId, month, bills: COUNT_INT })
    .from(bill)
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(and(gte(bill.createdAt, window.startAt), LIVE_BILL))
    .groupBy(property.ownerId, month);
}

/** Tenancy census per owner: how many are live, and when the last one arrived. */
export function tenantCensusPerOwner() {
  return db
    .select({
      ownerId: property.ownerId,
      activeTenants: sql<number>`count(*) filter (where ${tenant.status} = 'active')::int`,
      lastTenantAt: sql<Date | null>`max(${tenant.createdAt})`,
    })
    .from(tenant)
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .groupBy(property.ownerId);
}

export function bedCensusPerOwner() {
  return db
    .select({
      ownerId: property.ownerId,
      beds: COUNT_INT,
      firstBedAt: sql<Date | null>`min(${bed.createdAt})`,
    })
    .from(bed)
    .innerJoin(room, eq(bed.roomId, room.id))
    .innerJoin(property, eq(room.propertyId, property.id))
    .groupBy(property.ownerId);
}

export function lastBillPerOwner() {
  return db
    .select({ ownerId: property.ownerId, lastBillAt: sql<Date | null>`max(${bill.createdAt})` })
    .from(bill)
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(LIVE_BILL)
    .groupBy(property.ownerId);
}

export function billedPerOwnerForMonths(months: string[]) {
  return db
    .select({ ownerId: property.ownerId, month: bill.billMonth, billed: moneySum(bill.totalAmount) })
    .from(bill)
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(and(inSet(bill.billMonth, months), LIVE_BILL))
    .groupBy(property.ownerId, bill.billMonth);
}

export function collectedPerOwnerBetween(firstDay: string, dayAfterLast: string) {
  const month = monthOfDate(payment.paymentDate);
  return db
    .select({ ownerId: property.ownerId, month, collected: moneySum(payment.amount) })
    .from(payment)
    .innerJoin(bill, eq(payment.billId, bill.id))
    .innerJoin(tenant, eq(bill.tenantId, tenant.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(
      and(
        sql`${payment.paymentDate} >= ${firstDay}::date`,
        sql`${payment.paymentDate} < ${dayAfterLast}::date`,
        LIVE_BILL,
      ),
    )
    .groupBy(property.ownerId, month);
}

/** Identity for a known set of owners, for the churn list's contact column. */
export function ownerIdentities(ownerIds: string[]) {
  return db
    .select({
      ownerId: ownerProfile.id,
      status: ownerProfile.status,
      phone: ownerProfile.phone,
      name: user.name,
      email: user.email,
    })
    .from(ownerProfile)
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(and(inSet(ownerProfile.id, ownerIds), LIVE_OWNER));
}

// ===========================================================================
// 60s in-process memo
// ===========================================================================

const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

/**
 * Deliberately a `Map` and a timestamp: an admin screen refreshed by a handful
 * of operators does not need a warehouse, an event pipeline or a materialized
 * view, and every one of those would be a second copy of these definitions to
 * keep in step. The promise itself is cached, so a burst of refreshes collapses
 * onto one set of queries rather than N.
 */
function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

  const value = load();
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, value });
  // A failure must not be served for the next minute, and an unobserved
  // rejection must not reach the process-level handler.
  void value.catch(() => cache.delete(key));

  for (const [staleKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(staleKey);
  }

  return value;
}

/** Path plus normalised query string; the only inputs any handler here reads. */
function cacheKey(req: Request): string {
  const entries = Object.entries(req.query as Record<string, unknown>)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return `${req.baseUrl}${req.path}?${entries.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

/**
 * Wraps a handler in the memo. Express 5 forwards a rejected promise to the
 * error handler, so a failed load still surfaces as a 500 rather than hanging.
 */
function cached<T>(load: (req: Request) => Promise<T>) {
  return async (req: Request, res: Response) => {
    res.json(await memo(cacheKey(req), () => load(req)));
  };
}

// ===========================================================================
// Small numeric helpers
// ===========================================================================

const round1 = (value: number) => Math.round(value * 10) / 10;

/** A percentage to one decimal, with divide-by-zero pinned at 0. */
function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return round1((part / whole) * 100);
}

/** Percentage change, or null when there is no base to change from. */
function pctChange(value: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((value - previous) / previous) * 100);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return round1(value);
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

function daysSince(at: Date | null, now: Date): number | null {
  if (!at) return null;
  return Math.max(0, Math.floor(daysBetween(at, now)));
}

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Running total over `deltas`, seeded with `base`.
 *
 * This is how every cumulative series here is produced: one grouped query for
 * the per-month deltas plus one scalar seed, then a scan in JS. The series it
 * replaces asked the database for a fresh `<= month` total six times over.
 */
export function runningTotal(base: number, deltas: number[]): number[] {
  let total = base;
  return deltas.map((delta) => {
    total += delta;
    return total;
  });
}

/** `?months=` clamped to something a chart can actually render. */
function monthsParam(req: Request, fallback: number, max: number): number {
  const raw = Number(req.query.months);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.trunc(raw), 1), max);
}

/** Indexes grouped rows by month, coercing the money column once. */
function byMonth<T extends { month: string | null }>(rows: T[]): Map<string, T> {
  return new Map(rows.filter((row) => row.month !== null).map((row) => [row.month as string, row]));
}

// ===========================================================================
// GET /analytics  — kept for the existing admin dashboard, numbers corrected
// ===========================================================================

export interface PlatformAnalytics {
  totalOwners: number;
  /**
   * Replaces `totalUsers`, which was the same number by construction:
   * `ensureOwnerProfile` runs on every user create, so there was one
   * `owner_profile` per `user` and the dashboard showed one figure twice.
   *
   * An owner counts as activated once they have generated at least one
   * non-voided bill — the same definition retention uses, so the two screens
   * cannot disagree about who is a real user of the product.
   */
  activatedOwners: number;
  totalProperties: number;
  activeTenants: number;
}

router.get(
  "/analytics",
  cached(async (): Promise<PlatformAnalytics> => {
    const [ownerRows, activatedRows, propertyRows, tenantRows] = await Promise.all([
      db.select({ count: COUNT_INT }).from(ownerProfile).where(LIVE_OWNER),
      db
        .select({ count: sql<number>`count(distinct ${property.ownerId})::int` })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .innerJoin(property, eq(tenant.propertyId, property.id))
        .where(LIVE_BILL),
      db.select({ count: COUNT_INT }).from(property),
      db.select({ count: COUNT_INT }).from(tenant).where(eq(tenant.status, "active")),
    ]);

    return {
      totalOwners: aggregate(ownerRows, { count: 0 }).count,
      activatedOwners: aggregate(activatedRows, { count: 0 }).count,
      totalProperties: aggregate(propertyRows, { count: 0 }).count,
      activeTenants: aggregate(tenantRows, { count: 0 }).count,
    };
  }),
);

// ===========================================================================
// GET /analytics/trends
// ===========================================================================

const TREND_MONTHS = 6;

export interface TrendPoint {
  /** `YYYY-MM` in the Asia/Kolkata calendar. */
  month: string;
  /** NEW in this month. These were cumulative — and therefore never fell. */
  owners: number;
  properties: number;
  tenants: number;
  /** Billed FOR this business month (`bill.bill_month`), voided excluded. */
  billed: number;
  /** Cash recorded in this month, from the payment ledger. */
  collected: number;
  /** Still-open balance on this month's bills, voided excluded. */
  outstanding: number;
  /** Running totals, from one grouped query plus a seed — not N queries. */
  cumulativeOwners: number;
  cumulativeProperties: number;
  /** Open tenancies at month end: seed + running (joined − vacated). */
  activeTenants: number;
}

router.get(
  "/analytics/trends",
  cached(async (): Promise<TrendPoint[]> => {
    const window = monthWindow(TREND_MONTHS);

    const [owners, ownersBefore, properties, propertiesBefore, joined, vacated, tenantsBefore, billed, collected] =
      await Promise.all([
        ownersCreatedPerMonth(window),
        ownersBeforeWindow(window),
        propertiesCreatedPerMonth(window),
        propertiesBeforeWindow(window),
        tenantsJoinedPerMonth(window),
        tenantsVacatedPerMonth(window),
        activeTenantsBeforeWindow(window),
        billedPerMonth(window),
        collectedPerMonth(window),
      ]);

    const ownersBy = byMonth(owners);
    const propertiesBy = byMonth(properties);
    const joinedBy = byMonth(joined);
    const vacatedBy = byMonth(vacated);
    const billedBy = byMonth(billed);
    const collectedBy = byMonth(collected);

    const ownerDeltas = window.months.map((m) => ownersBy.get(m)?.count ?? 0);
    const propertyDeltas = window.months.map((m) => propertiesBy.get(m)?.count ?? 0);
    const tenantDeltas = window.months.map(
      (m) => (joinedBy.get(m)?.count ?? 0) - (vacatedBy.get(m)?.count ?? 0),
    );

    const cumulativeOwners = runningTotal(aggregate(ownersBefore, { count: 0 }).count, ownerDeltas);
    const cumulativeProperties = runningTotal(
      aggregate(propertiesBefore, { count: 0 }).count,
      propertyDeltas,
    );
    const activeTenants = runningTotal(aggregate(tenantsBefore, { count: 0 }).count, tenantDeltas);

    return window.months.map((month, index) => ({
      month,
      owners: ownerDeltas[index]!,
      properties: propertyDeltas[index]!,
      tenants: joinedBy.get(month)?.count ?? 0,
      billed: num(billedBy.get(month)?.billed),
      collected: num(collectedBy.get(month)?.collected),
      outstanding: num(billedBy.get(month)?.outstanding),
      cumulativeOwners: cumulativeOwners[index]!,
      cumulativeProperties: cumulativeProperties[index]!,
      activeTenants: activeTenants[index]!,
    }));
  }),
);

// ===========================================================================
// GET /metrics/overview
// ===========================================================================

export interface MetricDelta {
  value: number;
  previous: number;
  /** `value - previous`. */
  delta: number;
  /** Percentage change, or null when `previous` is 0 and there is no base. */
  deltaPct: number | null;
  /**
   * `cohort_month` compares the current IST calendar month against the one
   * before it; the current month is still running, so it is a partial figure by
   * construction. `rolling_30d` compares the last 30 days against the 30 before
   * those, which is complete on both sides.
   */
  basis: "cohort_month" | "rolling_30d";
}

export interface OverviewMetrics {
  timezone: typeof TIMEZONE;
  generatedAt: string;
  month: string;
  previousMonth: string;
  signups: MetricDelta;
  verified: MetricDelta;
  activated: MetricDelta;
  activeLast30d: MetricDelta;
  definitions: Record<string, string>;
}

function delta(
  value: number,
  previous: number,
  basis: MetricDelta["basis"],
): MetricDelta {
  return { value, previous, delta: value - previous, deltaPct: pctChange(value, previous), basis };
}

router.get(
  "/metrics/overview",
  cached(async (): Promise<OverviewMetrics> => {
    const now = new Date();
    const window = monthWindow(2, istCalendarNow(now));
    const month = window.lastMonth;
    const previousMonth = window.firstMonth;

    const rolling = {
      currentFrom: new Date(now.getTime() - 30 * MS_PER_DAY),
      previousFrom: new Date(now.getTime() - 60 * MS_PER_DAY),
    };

    const [signups, activated, billNow, billPrev, payNow, payPrev] = await Promise.all([
      signupsPerMonth(window),
      activatedPerSignupMonth(window),
      ownersBillingBetween(rolling.currentFrom, now),
      ownersBillingBetween(rolling.previousFrom, rolling.currentFrom),
      ownersRecordingPaymentsBetween(rolling.currentFrom, now),
      ownersRecordingPaymentsBetween(rolling.previousFrom, rolling.currentFrom),
    ]);

    const signupsBy = byMonth(signups);
    const activatedBy = byMonth(activated);

    // Billing and payments are two tables, so "active" is the union of the two
    // owner-id sets rather than a figure either query can produce alone.
    const activeOwners = (...batches: { ownerId: string }[][]) =>
      new Set(batches.flat().map((row) => row.ownerId)).size;

    return {
      timezone: TIMEZONE,
      generatedAt: now.toISOString(),
      month,
      previousMonth,
      signups: delta(
        signupsBy.get(month)?.signups ?? 0,
        signupsBy.get(previousMonth)?.signups ?? 0,
        "cohort_month",
      ),
      verified: delta(
        signupsBy.get(month)?.verified ?? 0,
        signupsBy.get(previousMonth)?.verified ?? 0,
        "cohort_month",
      ),
      activated: delta(
        activatedBy.get(month)?.activated ?? 0,
        activatedBy.get(previousMonth)?.activated ?? 0,
        "cohort_month",
      ),
      activeLast30d: delta(
        activeOwners(billNow, payNow),
        activeOwners(billPrev, payPrev),
        "rolling_30d",
      ),
      definitions: {
        signups: "Owner accounts created in the month (Asia/Kolkata).",
        verified:
          "Of the owners who signed up in the month, how many have since verified their email. `user.email_verified` carries no timestamp, so this is a cohort figure read as of now, not an event count.",
        activated:
          "Of the owners who signed up in the month, how many have since generated at least one non-voided bill.",
        activeLast30d:
          "Distinct owners who raised a bill or recorded a payment in the last 30 days, by when the row was written — not by the owner-supplied payment date, which is routinely back-dated.",
      },
    };
  }),
);

// ===========================================================================
// GET /metrics/funnel
// ===========================================================================

export type FunnelStageKey =
  | "signup"
  | "email_verified"
  | "property_created"
  | "bed_created"
  | "first_tenant"
  | "first_bill"
  | "first_payment";

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  count: number;
  /** Share of all signups, one decimal. */
  pctOfSignups: number;
  /** Share of the previous stage; null for `signup`. */
  conversionFromPrevious: number | null;
  /** Median days from signup to reaching this stage; null when untimestamped. */
  medianDaysFromSignup: number | null;
  /** Median days from the previous *timestamped* stage. */
  medianDaysFromPrevious: number | null;
}

export interface FunnelReport {
  timezone: typeof TIMEZONE;
  generatedAt: string;
  totalOwners: number;
  stages: FunnelStage[];
  /** The transition that loses the most owners — where to spend the next week. */
  biggestDropOff: {
    from: FunnelStageKey;
    to: FunnelStageKey;
    lostOwners: number;
    lostPct: number;
  } | null;
  notes: string[];
}

interface StageDefinition {
  key: FunnelStageKey;
  label: string;
  /** null when the owner has not reached the stage. */
  reachedAt: (ownerId: string, signupAt: Date, verified: boolean) => Date | null;
  /** `email_verified` is a boolean with no event row behind it. */
  timestamped: boolean;
}

router.get(
  "/metrics/funnel",
  cached(async (): Promise<FunnelReport> => {
    const [owners, properties, beds, tenants, bills, payments] = await Promise.all([
      ownerSignupRows(),
      firstPropertyPerOwner(),
      firstBedPerOwner(),
      firstTenantPerOwner(),
      firstBillPerOwner(),
      firstPaymentPerOwner(),
    ]);

    const index = (rows: { ownerId: string; at: Date | null }[]) =>
      new Map(rows.filter((row) => row.at !== null).map((row) => [row.ownerId, new Date(row.at!)]));

    const firstProperty = index(properties);
    const firstBed = index(beds);
    const firstTenant = index(tenants);
    const firstBill = index(bills);
    const firstPayment = index(payments);

    const stages: StageDefinition[] = [
      { key: "signup", label: "Signed up", timestamped: true, reachedAt: (_id, at) => at },
      {
        key: "email_verified",
        label: "Verified email",
        timestamped: false,
        reachedAt: (_id, _at, verified) => (verified ? new Date(0) : null),
      },
      {
        key: "property_created",
        label: "Created a property",
        timestamped: true,
        reachedAt: (id) => firstProperty.get(id) ?? null,
      },
      {
        key: "bed_created",
        label: "Added a bed",
        timestamped: true,
        reachedAt: (id) => firstBed.get(id) ?? null,
      },
      {
        key: "first_tenant",
        label: "Added a tenant",
        timestamped: true,
        reachedAt: (id) => firstTenant.get(id) ?? null,
      },
      {
        key: "first_bill",
        label: "Generated a bill",
        timestamped: true,
        reachedAt: (id) => firstBill.get(id) ?? null,
      },
      {
        key: "first_payment",
        label: "Recorded a payment",
        timestamped: true,
        reachedAt: (id) => firstPayment.get(id) ?? null,
      },
    ];

    // One pass per stage over the owner list, in memory — not one query per
    // stage per owner.
    const reached = stages.map((stage) =>
      owners.map((owner) =>
        stage.reachedAt(owner.ownerId, new Date(owner.signupAt), owner.emailVerified),
      ),
    );

    const totalOwners = owners.length;
    const out: FunnelStage[] = stages.map((stage, stageIndex) => {
      const hits = reached[stageIndex]!;
      const count = hits.filter((at) => at !== null).length;

      // The previous stage a duration can be measured from. `email_verified`
      // has no timestamp, so `property_created` is timed from signup instead.
      let prevTimed = stageIndex - 1;
      while (prevTimed > 0 && !stages[prevTimed]!.timestamped) prevTimed -= 1;

      const fromSignup: number[] = [];
      const fromPrevious: number[] = [];
      if (stage.timestamped && stageIndex > 0) {
        for (let i = 0; i < owners.length; i += 1) {
          const at = hits[i];
          if (!at) continue;
          const signupAt = new Date(owners[i]!.signupAt);
          fromSignup.push(Math.max(0, daysBetween(signupAt, at)));
          const previousAt = reached[prevTimed]![i];
          if (previousAt) fromPrevious.push(Math.max(0, daysBetween(previousAt, at)));
        }
      }

      const previousCount = stageIndex === 0 ? null : reached[stageIndex - 1]!.filter(Boolean).length;

      return {
        key: stage.key,
        label: stage.label,
        count,
        pctOfSignups: rate(count, totalOwners),
        conversionFromPrevious: previousCount === null ? null : rate(count, previousCount),
        medianDaysFromSignup: stageIndex === 0 ? 0 : median(fromSignup),
        medianDaysFromPrevious: stageIndex === 0 ? 0 : median(fromPrevious),
      };
    });

    let biggestDropOff: FunnelReport["biggestDropOff"] = null;
    for (let i = 1; i < out.length; i += 1) {
      const lost = out[i - 1]!.count - out[i]!.count;
      if (lost <= 0) continue;
      if (biggestDropOff && lost <= biggestDropOff.lostOwners) continue;
      biggestDropOff = {
        from: out[i - 1]!.key,
        to: out[i]!.key,
        lostOwners: lost,
        lostPct: rate(lost, out[i - 1]!.count),
      };
    }

    return {
      timezone: TIMEZONE,
      generatedAt: new Date().toISOString(),
      totalOwners,
      stages: out,
      biggestDropOff,
      notes: [
        "Stages are evaluated independently, not as a strict nesting. The structural stages do nest by foreign key (a bill implies a tenant implies a property), but email verification does not — an owner can build out a property without ever clicking the link — so `email_verified` may sit below `property_created`.",
        "`email_verified` has no timestamp in the schema (`user.email_verified` is a boolean), so its time-to-stage is null rather than guessed.",
      ],
    };
  }),
);

// ===========================================================================
// GET /metrics/retention
// ===========================================================================

const RETENTION_COHORTS = 6;

export interface RetentionPeriod {
  /** Months since the cohort's signup month. 0 is the signup month itself. */
  period: number;
  retained: number;
  rate: number;
}

export interface RetentionCohort {
  /** `YYYY-MM` signup month, Asia/Kolkata. */
  cohort: string;
  size: number;
  /** Only periods that have actually elapsed; no zero-padding into the future. */
  periods: RetentionPeriod[];
}

export interface RetentionReport {
  timezone: typeof TIMEZONE;
  generatedAt: string;
  definition: string;
  cohorts: RetentionCohort[];
  /** Mean rate across every cohort old enough to have reached that period. */
  averageByPeriod: { period: number; rate: number; cohorts: number }[];
}

router.get(
  "/metrics/retention",
  cached(async (): Promise<RetentionReport> => {
    const asOf = istCalendarNow();
    const window = monthWindow(RETENTION_COHORTS, asOf);
    const currentMonth = window.lastMonth;

    const [cohortRows, activity] = await Promise.all([
      ownerCohorts(window),
      billingMonthsPerOwner(window),
    ]);

    const active = new Set(activity.map((row) => `${row.ownerId}|${row.month}`));

    const cohortMembers = new Map<string, string[]>();
    for (const row of cohortRows) {
      if (!row.cohort) continue;
      const members = cohortMembers.get(row.cohort) ?? [];
      members.push(row.ownerId);
      cohortMembers.set(row.cohort, members);
    }

    const totals = new Map<number, { rateSum: number; cohorts: number }>();

    const cohorts: RetentionCohort[] = window.months.map((cohort) => {
      const members = cohortMembers.get(cohort) ?? [];
      const periods: RetentionPeriod[] = [];

      for (let period = 0; ; period += 1) {
        const month = shiftMonth(cohort, period);
        // Stop at the current month: a period that has not happened yet is not
        // 0% retention, it is unknown, and padding it would drag every average
        // down as the window rolls forward.
        if (month > currentMonth) break;
        const retained = members.filter((ownerId) => active.has(`${ownerId}|${month}`)).length;
        const value = rate(retained, members.length);
        periods.push({ period, retained, rate: value });

        if (members.length > 0) {
          const entry = totals.get(period) ?? { rateSum: 0, cohorts: 0 };
          entry.rateSum += value;
          entry.cohorts += 1;
          totals.set(period, entry);
        }
      }

      return { cohort, size: members.length, periods };
    });

    return {
      timezone: TIMEZONE,
      generatedAt: new Date().toISOString(),
      definition:
        "Retained = the owner generated at least one non-voided bill in that Asia/Kolkata calendar month. Logins are deliberately not the signal: PG owners sign in around the 1st-5th and vanish, so session activity reports a churned account as healthy. Billing is the product's heartbeat.",
      cohorts,
      averageByPeriod: [...totals.entries()]
        .sort(([a], [b]) => a - b)
        .map(([period, entry]) => ({
          period,
          rate: round1(entry.rateSum / entry.cohorts),
          cohorts: entry.cohorts,
        })),
    };
  }),
);

// ===========================================================================
// GET /metrics/churn-risk
// ===========================================================================

/** Longer than any monthly cycle: an owner past this has stopped billing. */
const BILLING_LAPSED_DAYS = 45;

/** Beds built, nobody in them, and long enough that it is not still setup. */
const NO_TENANT_DAYS = 30;

/** Percentage *points*, not percent: 80% -> 55% is a 25pp drop. */
const COLLECTION_DROP_PP = 20;

/** The list is for working through, not for scrolling. */
const MAX_RISK_ROWS = 200;

export type ChurnRiskCode = "billing_lapsed" | "no_tenants" | "collection_rate_drop";

export interface ChurnRiskReason {
  code: ChurnRiskCode;
  severity: "high" | "medium";
  message: string;
  metrics: Record<string, number | null>;
}

export interface ChurnRiskRow {
  ownerId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  /** Owner 360 in the admin app. */
  href: string;
  /** The worst of `reasons`. */
  severity: "high" | "medium";
  reasons: ChurnRiskReason[];
  activeTenants: number;
  beds: number;
  daysSinceLastBill: number | null;
  lastBillAt: string | null;
  /** Percent, for the more recent of the two complete months compared. */
  collectionRate: number | null;
  previousCollectionRate: number | null;
}

export interface ChurnRiskReport {
  generatedAt: string;
  timezone: typeof TIMEZONE;
  thresholds: {
    billingLapsedDays: number;
    noTenantDays: number;
    collectionDropPp: number;
  };
  /**
   * The two *complete* months the collection comparison uses. The month in
   * progress is deliberately not one of them: a partial month always looks like
   * a collapse next to a full one, and would flag most of the platform on the
   * 3rd of every month.
   */
  comparedMonths: { current: string; previous: string };
  counts: Record<ChurnRiskCode, number> & { owners: number };
  truncated: boolean;
  rows: ChurnRiskRow[];
}

router.get(
  "/metrics/churn-risk",
  cached(async (): Promise<ChurnRiskReport> => {
    const now = new Date();
    const thisMonth = istMonthKey(now);
    const currentComplete = shiftMonth(thisMonth, -1);
    const previousComplete = shiftMonth(thisMonth, -2);
    const comparedMonths = [previousComplete, currentComplete];

    const [tenants, bedsRows, lastBills, billedRows, collectedRows] = await Promise.all([
      tenantCensusPerOwner(),
      bedCensusPerOwner(),
      lastBillPerOwner(),
      billedPerOwnerForMonths(comparedMonths),
      collectedPerOwnerBetween(`${previousComplete}-01`, `${thisMonth}-01`),
    ]);

    const tenantsBy = new Map(tenants.map((row) => [row.ownerId, row]));
    const bedsBy = new Map(bedsRows.map((row) => [row.ownerId, row]));
    const lastBillBy = new Map(lastBills.map((row) => [row.ownerId, row.lastBillAt]));

    const byOwnerMonth = <T extends { ownerId: string; month: string | null }>(
      rows: T[],
      pick: (row: T) => string,
    ) => new Map(rows.map((row) => [`${row.ownerId}|${row.month}`, num(pick(row))]));

    const billedBy = byOwnerMonth(billedRows, (row) => row.billed);
    const collectedBy = byOwnerMonth(collectedRows, (row) => row.collected);

    const collectionRate = (ownerId: string, month: string): number | null => {
      const billed = billedBy.get(`${ownerId}|${month}`) ?? 0;
      if (billed <= 0) return null;
      return rate(collectedBy.get(`${ownerId}|${month}`) ?? 0, billed);
    };

    // Only owners that appear in one of the aggregates can be at risk; an owner
    // with no property has no bed, no tenant and no bill, and belongs on the
    // activation funnel rather than on a churn list.
    const candidates = new Set([
      ...tenantsBy.keys(),
      ...bedsBy.keys(),
      ...lastBillBy.keys(),
      ...billedRows.map((row) => row.ownerId),
    ]);

    const drafts = new Map<string, Omit<ChurnRiskRow, "name" | "email" | "phone" | "status">>();

    for (const ownerId of candidates) {
      const census = tenantsBy.get(ownerId);
      const bedCensus = bedsBy.get(ownerId);
      const activeTenants = census?.activeTenants ?? 0;
      const beds = bedCensus?.beds ?? 0;
      const lastBillAt = lastBillBy.get(ownerId) ?? null;
      const sinceLastBill = daysSince(lastBillAt ? new Date(lastBillAt) : null, now);

      const reasons: ChurnRiskReason[] = [];

      // 1. They went back to the notebook.
      if (activeTenants > 0 && (sinceLastBill === null || sinceLastBill >= BILLING_LAPSED_DAYS)) {
        reasons.push({
          code: "billing_lapsed",
          severity: "high",
          message:
            sinceLastBill === null
              ? `${activeTenants} active tenant(s) and no bill has ever been raised`
              : `No bill raised in ${sinceLastBill} days, with ${activeTenants} active tenant(s)`,
          metrics: { activeTenants, daysSinceLastBill: sinceLastBill },
        });
      }

      // 2. Beds built, nobody moved in, and setup ended a month ago.
      const bedAge = daysSince(bedCensus?.firstBedAt ? new Date(bedCensus.firstBedAt) : null, now);
      const sinceLastTenant = daysSince(
        census?.lastTenantAt ? new Date(census.lastTenantAt) : null,
        now,
      );
      if (
        beds > 0 &&
        activeTenants === 0 &&
        (bedAge ?? 0) >= NO_TENANT_DAYS &&
        (sinceLastTenant === null || sinceLastTenant >= NO_TENANT_DAYS)
      ) {
        reasons.push({
          code: "no_tenants",
          severity: "medium",
          message: `${beds} bed(s) set up and no active tenant for ${sinceLastTenant ?? bedAge} days`,
          metrics: { beds, daysSinceLastTenant: sinceLastTenant, daysSinceFirstBed: bedAge },
        });
      }

      // 3. Collection fell off a cliff between the last two complete months.
      const current = collectionRate(ownerId, currentComplete);
      const previous = collectionRate(ownerId, previousComplete);
      if (current !== null && previous !== null && previous - current > COLLECTION_DROP_PP) {
        reasons.push({
          code: "collection_rate_drop",
          severity: "high",
          message: `Collection rate fell ${round1(previous - current)}pp, from ${previous}% in ${previousComplete} to ${current}% in ${currentComplete}`,
          metrics: {
            collectionRate: current,
            previousCollectionRate: previous,
            dropPp: round1(previous - current),
          },
        });
      }

      if (reasons.length === 0) continue;

      drafts.set(ownerId, {
        ownerId,
        href: `/dashboard/owners/${ownerId}`,
        severity: reasons.some((reason) => reason.severity === "high") ? "high" : "medium",
        reasons,
        activeTenants,
        beds,
        daysSinceLastBill: sinceLastBill,
        lastBillAt: iso(lastBillAt ? new Date(lastBillAt) : null),
        collectionRate: current,
        previousCollectionRate: previous,
      });
    }

    // Identity is fetched only for owners that actually fired a rule, and the
    // helper degrades an empty id list to a constant-false predicate rather
    // than emitting `in ()`.
    const identities = await ownerIdentities([...drafts.keys()]);

    const rows: ChurnRiskRow[] = identities
      .map((identity) => {
        const draft = drafts.get(identity.ownerId)!;
        return {
          ...draft,
          name: identity.name,
          email: identity.email,
          phone: identity.phone,
          status: identity.status,
        };
      })
      .sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
        if (a.reasons.length !== b.reasons.length) return b.reasons.length - a.reasons.length;
        // Biggest blast radius first: an owner with 40 tenants who stopped
        // billing is a different call from one with two.
        return b.activeTenants - a.activeTenants;
      });

    const counts = { billing_lapsed: 0, no_tenants: 0, collection_rate_drop: 0, owners: rows.length };
    for (const row of rows) for (const reason of row.reasons) counts[reason.code] += 1;

    return {
      generatedAt: now.toISOString(),
      timezone: TIMEZONE,
      thresholds: {
        billingLapsedDays: BILLING_LAPSED_DAYS,
        noTenantDays: NO_TENANT_DAYS,
        collectionDropPp: COLLECTION_DROP_PP,
      },
      comparedMonths: { current: currentComplete, previous: previousComplete },
      counts,
      truncated: rows.length > MAX_RISK_ROWS,
      rows: rows.slice(0, MAX_RISK_ROWS),
    };
  }),
);

// ===========================================================================
// GET /metrics/volume
// ===========================================================================

const VOLUME_MONTHS = 12;
const MAX_VOLUME_MONTHS = 24;

/**
 * PGKhata never touches this money. There is no payment gateway: owners record
 * cash and UPI they collected themselves, and the platform's cut of it is zero.
 * Calling this "revenue" anywhere in the UI would eventually put a number in
 * front of an investor that the company has no claim to, so the label ships
 * with the payload rather than being left to whoever builds the chart.
 */
const VOLUME_LABEL = "Volume under management";

const VOLUME_DISCLAIMER =
  "Volume under management, NOT revenue. PGKhata has no payment gateway and never handles this money; these are amounts owners billed and recorded as collected themselves.";

export interface VolumeMonth {
  month: string;
  /** Billed for this business month (`bill.bill_month`), voided excluded. */
  billed: number;
  /** Cash recorded in this calendar month, from the payment ledger. */
  collected: number;
  /** Still-open balance on this month's bills, as of now. */
  outstanding: number;
  /** `billed - outstanding`: how much of this month's billing has been settled. */
  settled: number;
  /** `settled / billed`, percent. Same axis on both sides, unlike collected. */
  collectionRate: number;
  billCount: number;
  paymentCount: number;
}

export interface VolumeReport {
  label: typeof VOLUME_LABEL;
  disclaimer: typeof VOLUME_DISCLAIMER;
  currency: "INR";
  timezone: typeof TIMEZONE;
  generatedAt: string;
  definitions: Record<string, string>;
  months: VolumeMonth[];
  totals: {
    billed: number;
    collected: number;
    outstanding: number;
    settled: number;
    collectionRate: number;
  };
}

router.get(
  "/metrics/volume",
  cached(async (req): Promise<VolumeReport> => {
    const window = monthWindow(monthsParam(req, VOLUME_MONTHS, MAX_VOLUME_MONTHS));

    const [billed, collected] = await Promise.all([
      billedPerMonth(window),
      collectedPerMonth(window),
    ]);

    const billedBy = byMonth(billed);
    const collectedBy = byMonth(collected);

    const months: VolumeMonth[] = window.months.map((month) => {
      const billedRow = billedBy.get(month);
      const collectedRow = collectedBy.get(month);
      const billedTotal = num(billedRow?.billed);
      const outstanding = num(billedRow?.outstanding);
      const settled = billedTotal - outstanding;

      return {
        month,
        billed: billedTotal,
        collected: num(collectedRow?.collected),
        outstanding,
        settled,
        collectionRate: rate(settled, billedTotal),
        billCount: billedRow?.billCount ?? 0,
        paymentCount: collectedRow?.paymentCount ?? 0,
      };
    });

    const sum = (pick: (m: VolumeMonth) => number) =>
      months.reduce((total, m) => total + pick(m), 0);

    const totalBilled = sum((m) => m.billed);
    const totalSettled = sum((m) => m.settled);

    return {
      label: VOLUME_LABEL,
      disclaimer: VOLUME_DISCLAIMER,
      currency: "INR",
      timezone: TIMEZONE,
      generatedAt: new Date().toISOString(),
      definitions: {
        billed: "Sum of non-voided bill totals for that business month (bill.bill_month).",
        collected:
          "Sum of payment.amount whose payment_date falls in that calendar month, against non-voided bills. This is a cash-flow series and may settle bills from earlier months.",
        outstanding:
          "Sum of the still-open balance on that month's non-voided bills, read as of now. Voided bills are excluded because the bill_balance_consistent CHECK exempts them, so a voided row can carry a positive balance.",
        settled: "billed - outstanding, i.e. how much of that month's billing has since been paid.",
        collectionRate: "settled / billed, as a percentage. Both sides are the same month's bills.",
      },
      months,
      totals: {
        billed: totalBilled,
        collected: sum((m) => m.collected),
        outstanding: sum((m) => m.outstanding),
        settled: totalSettled,
        collectionRate: rate(totalSettled, totalBilled),
      },
    };
  }),
);

export default router;
