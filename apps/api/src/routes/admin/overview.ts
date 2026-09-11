import { Router } from "express";
import {
  db,
  session,
  user,
  ownerProfile,
  property,
  floor,
  room,
  bed,
  tenant,
  bill,
  payment,
} from "@pgkhata/db";
import { eq, and, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { aggregate, param } from "../../lib/http";
import {
  daysOverdue,
  summarizeAging,
  type AgingReport,
  type AgingRow,
} from "../../lib/dashboard-analytics";

/**
 * `GET /v1/admin/owners/:ownerId/overview` — Owner 360.
 *
 * One payload, one screen, because the second click in "phone number -> the
 * bill" lands here and the agent has an owner on the phone. `/owners/:id` and
 * `/owners/:id/details` stay as they are; they answer "who is this" and feed
 * the existing list pages. This answers "what is wrong with this account", and
 * it is deliberately allowed to be a bigger query than either, since it
 * replaces the four or five the agent would otherwise run by hand.
 *
 * Open to `support` — reading an owner's health is the support job. As with
 * every admin sub-router this one is mounted at "/", so any role guard must go
 * on the route itself and never on `router.use`, or it would also run for the
 * sibling routers' requests.
 *
 * PRIVACY: this payload deliberately selects no KYC columns at all.
 * `tenant.aadhaarNumber` and `tenant.panNumber` are stored in plaintext, and an
 * account-health screen has no use for either. If a future field here ever does
 * need them, it must surface the last four digits only — never the full value.
 */

const router = Router();

/** A bill still unpaid this long after its due date is no longer "late". */
const STALE_BILL_DAYS = 60;

/** Longer than any monthly cycle: an owner past this has stopped billing. */
const BILLING_STALLED_DAYS = 45;

/** Enough to recognise the pattern; the linked list pages hold the rest. */
const SAMPLE_LIMIT = 5;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --------------------------------------------------------------------------
// Response contract
// --------------------------------------------------------------------------

export interface OwnerIdentity {
  id: string;
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  signedUpAt: string;
  profileCreatedAt: string;
  /**
   * Account lifecycle. Without the reason the console can say an account is
   * paused but not why, which is the entire question on the callback.
   */
  status: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  /**
   * Login recency without a new column and without a write on every request.
   * better-auth already refreshes `session.updated_at` on its `updateAge`
   * (1 day), so `max(session.updated_at)` is "last seen, to within a day" for
   * free. Null means no session row has ever existed for this user — either
   * they have never signed in, or every session has since been pruned.
   */
  lastSeenAt: string | null;
}

export interface PortfolioProperty {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  electricityMode: string;
  /**
   * Not the VPA itself. An owner with no UPI VPA cannot be paid digitally,
   * which is a real support finding, but the address is the owner's to show.
   */
  hasUpiVpa: boolean;
  createdAt: string;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  maintenanceBeds: number;
  /** Occupied as a percentage of all beds, maintenance included in the base. */
  occupancyRate: number;
  activeTenants: number;
}

export interface Portfolio {
  propertyCount: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  maintenanceBeds: number;
  occupancyRate: number;
  activeTenants: number;
  propertiesWithoutUpi: number;
  properties: PortfolioProperty[];
}

export interface BillingHealth {
  /** `YYYY-MM`, the month the current-month figures cover. */
  month: string;
  billed: number;
  collected: number;
  outstanding: number;
  /** Collected as a percentage of billed this month; 0 when nothing is billed. */
  collectionRate: number;
  billCount: number;
  /** Across all time, not just this month. */
  openBillCount: number;
  openBalance: number;
  aging: AgingReport;
  lastBillAt: string | null;
  lastPaymentAt: string | null;
}

export type ActivationStepKey =
  | "property"
  | "structure"
  | "bed"
  | "tenant"
  | "bill"
  | "payment";

export interface ActivationStep {
  key: ActivationStepKey;
  label: string;
  done: boolean;
  at: string | null;
}

export interface Activation {
  complete: boolean;
  /** The first step not done, which is where this account is actually stuck. */
  stalledAt: ActivationStepKey | null;
  steps: ActivationStep[];
}

export type RiskFlagCode =
  | "stale_unpaid_bills"
  | "occupied_beds_without_tenant"
  | "active_tenants_without_bed"
  | "billing_stalled"
  | "missing_upi_vpa";

export interface RiskFlagSample {
  id: string;
  label: string;
  href: string;
}

export interface RiskFlag {
  code: RiskFlagCode;
  severity: "high" | "medium" | "low";
  /** How many rows are affected; for `billing_stalled`, days since the last bill. */
  count: number;
  message: string;
  sample: RiskFlagSample[];
}

export interface OwnerOverview {
  owner: OwnerIdentity;
  portfolio: Portfolio;
  billing: BillingHealth;
  activation: Activation;
  /** Only flags that actually fire. An empty array is a healthy account. */
  riskFlags: RiskFlag[];
}

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

/** Mirrors `currentMonth()` in routes/dashboard.ts so both read the same bills. */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** A percentage to one decimal, with the divide-by-zero case pinned at 0. */
function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function daysSince(value: Date | null): number | null {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

const ZERO_MIN_MAX = { first: null as Date | null, last: null as Date | null };

/** `min(col)`/`max(col)` over a scope, as one row. */
const minMax = (column: AnyPgColumn) => ({
  first: sql<Date | null>`min(${column})`,
  last: sql<Date | null>`max(${column})`,
});

/**
 * `inArray(col, [])` renders as `in ()`, which Postgres rejects as a syntax
 * error rather than matching nothing — and an owner with zero properties is
 * exactly the account support is called about, so that path is load-bearing.
 *
 * Degrading to a literal `false` rather than skipping the query keeps every
 * branch below shaped identically; Postgres turns a constant-false WHERE into a
 * one-time filter and never touches the table, so the cost is a round trip, not
 * a scan.
 */
function inScope(column: AnyPgColumn, ids: string[]): SQL {
  return ids.length > 0 ? inArray(column, ids) : sql`false`;
}

// --------------------------------------------------------------------------

router.get("/owners/:ownerId/overview", async (req: AuthenticatedRequest, res) => {
  const ownerId = param(req, "ownerId");
  // An id that is not UUID-shaped reaches Postgres as `invalid input syntax for
  // type uuid` (22P02), which the admin error translator does not map — so it
  // would surface as a 500 for what is plainly a missing owner.
  if (!UUID_RE.test(ownerId)) return res.status(404).json({ error: "Owner not found" });

  const [owner] = await db
    .select({
      id: ownerProfile.id,
      userId: ownerProfile.userId,
      phone: ownerProfile.phone,
      profileCreatedAt: ownerProfile.createdAt,
      status: ownerProfile.status,
      suspendedAt: ownerProfile.suspendedAt,
      suspendedReason: ownerProfile.suspendedReason,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      signedUpAt: user.createdAt,
    })
    .from(ownerProfile)
    .innerJoin(user, eq(ownerProfile.userId, user.id))
    .where(eq(ownerProfile.id, ownerId))
    .limit(1);

  if (!owner) return res.status(404).json({ error: "Owner not found" });

  const [lastSeenRows, properties] = await Promise.all([
    db
      .select({ lastSeenAt: sql<Date | null>`max(${session.updatedAt})` })
      .from(session)
      .where(eq(session.userId, owner.userId)),
    db
      .select({
        id: property.id,
        name: property.name,
        code: property.code,
        city: property.city,
        electricityMode: property.electricityMode,
        upiVpa: property.upiVpa,
        createdAt: property.createdAt,
      })
      .from(property)
      .where(eq(property.ownerId, ownerId)),
  ]);

  const identity: OwnerIdentity = {
    id: owner.id,
    userId: owner.userId,
    name: owner.name,
    email: owner.email,
    emailVerified: owner.emailVerified,
    phone: owner.phone,
    signedUpAt: iso(owner.signedUpAt)!,
    profileCreatedAt: iso(owner.profileCreatedAt)!,
    status: owner.status,
    suspendedAt: iso(owner.suspendedAt),
    suspendedReason: owner.suspendedReason,
    lastSeenAt: iso(aggregate(lastSeenRows, { lastSeenAt: null }).lastSeenAt),
  };

  const propertyIds = properties.map((p) => p.id);
  const month = currentMonth();

  /**
   * Ten grouped queries, in parallel, and not one of them fans out per
   * property. The portfolio table below is assembled in JS from the grouped
   * rows rather than by asking the database once per property — an owner with
   * twelve buildings would otherwise cost forty round trips.
   */
  const [
    bedRows,
    tenantRows,
    floorFirst,
    roomFirst,
    monthRows,
    billSpan,
    paymentSpan,
    openBills,
    orphanBeds,
    bedlessTenants,
  ] = await Promise.all([
    // Bed census per property AND per status in one grouped pass — one row per
    // (property, status), never one query per property.
    db
      .select({
        propertyId: room.propertyId,
        status: bed.status,
        count: sql<number>`count(*)::int`,
        first: sql<Date | null>`min(${bed.createdAt})`,
      })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(inScope(room.propertyId, propertyIds))
      .groupBy(room.propertyId, bed.status),

    db
      .select({
        propertyId: tenant.propertyId,
        active: sql<number>`count(*) filter (where ${tenant.status} = 'active')::int`,
        first: sql<Date | null>`min(${tenant.createdAt})`,
      })
      .from(tenant)
      .where(inScope(tenant.propertyId, propertyIds))
      .groupBy(tenant.propertyId),

    db
      .select({ first: sql<Date | null>`min(${floor.createdAt})` })
      .from(floor)
      .where(inScope(floor.propertyId, propertyIds)),

    db
      .select({ first: sql<Date | null>`min(${room.createdAt})` })
      .from(room)
      .where(inScope(room.propertyId, propertyIds)),

    // Billed and collected come off the same rows; two queries would scan the
    // same month twice.
    db
      .select({
        billed: sql<number>`coalesce(sum(${bill.totalAmount}), 0)::int`,
        collected: sql<number>`coalesce(sum(${bill.paidAmount}), 0)::int`,
        billCount: sql<number>`count(*)::int`,
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(
        and(
          inScope(tenant.propertyId, propertyIds),
          eq(bill.billMonth, month),
          isNull(bill.voidedAt),
        ),
      ),

    db
      .select(minMax(bill.createdAt))
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(inScope(tenant.propertyId, propertyIds), isNull(bill.voidedAt))),

    db
      .select(minMax(payment.createdAt))
      .from(payment)
      .innerJoin(bill, eq(payment.billId, bill.id))
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(inScope(tenant.propertyId, propertyIds)),

    // Every still-open bill, which is what both the aging report and the
    // stale-bill flag are computed from. Voided bills are excluded: the
    // `bill_balance_consistent` check exempts them, so a voided row can still
    // carry a positive balance and would inflate outstanding.
    db
      .select({
        id: bill.id,
        tenantId: bill.tenantId,
        tenantName: tenant.name,
        billMonth: bill.billMonth,
        balance: bill.balance,
        dueDate: bill.dueDate,
        createdAt: bill.createdAt,
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(
        and(
          inScope(tenant.propertyId, propertyIds),
          sql`${bill.balance} > 0`,
          isNull(bill.voidedAt),
        ),
      ),

    // Drift the owner cannot see: the bed says occupied, no active tenant holds
    // it. Occupancy is reported off `bed.status`, so these beds are silently
    // counted as earning.
    db
      .select({
        id: bed.id,
        bedNumber: bed.number,
        roomNumber: room.number,
        propertyId: room.propertyId,
        propertyName: property.name,
      })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .innerJoin(property, eq(room.propertyId, property.id))
      .leftJoin(tenant, and(eq(tenant.bedId, bed.id), eq(tenant.status, "active")))
      .where(
        and(inScope(room.propertyId, propertyIds), eq(bed.status, "occupied"), isNull(tenant.id)),
      ),

    // The mirror image: an active tenant holding no bed is billed from no rent
    // source and shows up in no room.
    db
      .select({
        id: tenant.id,
        name: tenant.name,
        phone: tenant.phone,
        propertyName: property.name,
      })
      .from(tenant)
      .innerJoin(property, eq(tenant.propertyId, property.id))
      .where(
        and(
          inScope(tenant.propertyId, propertyIds),
          eq(tenant.status, "active"),
          isNull(tenant.bedId),
        ),
      ),
  ]);

  // ---- Portfolio ---------------------------------------------------------

  const bedsByProperty = new Map<string, Map<string, number>>();
  for (const row of bedRows) {
    const byStatus = bedsByProperty.get(row.propertyId) ?? new Map<string, number>();
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + row.count);
    bedsByProperty.set(row.propertyId, byStatus);
  }

  const activeByProperty = new Map(tenantRows.map((row) => [row.propertyId, row.active]));

  const portfolioProperties: PortfolioProperty[] = properties.map((p) => {
    const byStatus = bedsByProperty.get(p.id) ?? new Map<string, number>();
    const occupiedBeds = byStatus.get("occupied") ?? 0;
    const vacantBeds = byStatus.get("vacant") ?? 0;
    const maintenanceBeds = byStatus.get("maintenance") ?? 0;
    let totalBeds = 0;
    for (const count of byStatus.values()) totalBeds += count;

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      city: p.city,
      electricityMode: p.electricityMode,
      hasUpiVpa: Boolean(p.upiVpa && p.upiVpa.trim().length > 0),
      createdAt: iso(p.createdAt)!,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      maintenanceBeds,
      occupancyRate: rate(occupiedBeds, totalBeds),
      activeTenants: activeByProperty.get(p.id) ?? 0,
    };
  });

  const sum = (pick: (p: PortfolioProperty) => number) =>
    portfolioProperties.reduce((total, p) => total + pick(p), 0);

  const totalBeds = sum((p) => p.totalBeds);
  const occupiedBeds = sum((p) => p.occupiedBeds);
  const propertiesWithoutUpi = portfolioProperties.filter((p) => !p.hasUpiVpa);

  const portfolio: Portfolio = {
    propertyCount: portfolioProperties.length,
    totalBeds,
    occupiedBeds,
    vacantBeds: sum((p) => p.vacantBeds),
    maintenanceBeds: sum((p) => p.maintenanceBeds),
    occupancyRate: rate(occupiedBeds, totalBeds),
    activeTenants: sum((p) => p.activeTenants),
    propertiesWithoutUpi: propertiesWithoutUpi.length,
    properties: portfolioProperties,
  };

  // ---- Billing health ----------------------------------------------------

  const { billed, collected, billCount } = aggregate(monthRows, {
    billed: 0,
    collected: 0,
    billCount: 0,
  });

  // `summarizeAging` wants { tenantId, balance, daysOverdue } and always
  // returns all five buckets in order, zeros included — the same contract the
  // owner dashboard's outstanding-payment chart is built on.
  const agingRows: AgingRow[] = openBills.map((b) => ({
    tenantId: b.tenantId,
    balance: b.balance,
    daysOverdue: daysOverdue(b.dueDate),
  }));

  const billSpanRow = aggregate(billSpan, ZERO_MIN_MAX);
  const paymentSpanRow = aggregate(paymentSpan, ZERO_MIN_MAX);

  const billing: BillingHealth = {
    month,
    billed,
    collected,
    outstanding: billed - collected,
    collectionRate: rate(collected, billed),
    billCount,
    openBillCount: openBills.length,
    openBalance: openBills.reduce((total, b) => total + b.balance, 0),
    aging: summarizeAging(agingRows),
    lastBillAt: iso(billSpanRow.last),
    lastPaymentAt: iso(paymentSpanRow.last),
  };

  // ---- Activation checklist ----------------------------------------------

  const earliest = (...values: (Date | null)[]): Date | null =>
    values
      .filter((value): value is Date => value instanceof Date)
      .reduce<Date | null>((best, value) => (best === null || value < best ? value : best), null);

  const firstProperty = earliest(...properties.map((p) => p.createdAt));
  const firstStructure = earliest(
    aggregate(floorFirst, { first: null as Date | null }).first,
    aggregate(roomFirst, { first: null as Date | null }).first,
  );
  const firstBed = earliest(...bedRows.map((row) => row.first));
  const firstTenant = earliest(...tenantRows.map((row) => row.first));

  const stepDefinitions: [ActivationStepKey, string, Date | null][] = [
    ["property", "First property created", firstProperty],
    ["structure", "First floor or room added", firstStructure],
    ["bed", "First bed added", firstBed],
    ["tenant", "First tenant added", firstTenant],
    ["bill", "First bill generated", billSpanRow.first],
    ["payment", "First payment recorded", paymentSpanRow.first],
  ];

  const steps: ActivationStep[] = stepDefinitions.map(([key, label, at]) => ({
    key,
    label,
    done: at !== null,
    at: iso(at),
  }));

  const activation: Activation = {
    complete: steps.every((step) => step.done),
    stalledAt: steps.find((step) => !step.done)?.key ?? null,
    steps,
  };

  // ---- Risk flags --------------------------------------------------------

  const riskFlags: RiskFlag[] = [];

  // `dueDate` is nullable; a bill with none is aged from when it was raised,
  // which is the only other date that means anything to the owner.
  const staleBills = openBills.filter(
    (b) => daysOverdue(b.dueDate ?? b.createdAt) > STALE_BILL_DAYS,
  );
  if (staleBills.length > 0) {
    riskFlags.push({
      code: "stale_unpaid_bills",
      severity: "high",
      count: staleBills.length,
      message: `${staleBills.length} bill(s) still carry a balance more than ${STALE_BILL_DAYS} days past due`,
      sample: staleBills.slice(0, SAMPLE_LIMIT).map((b) => ({
        id: b.id,
        label: `${b.billMonth} — ${b.tenantName} (₹${b.balance.toLocaleString("en-IN")} open)`,
        href: `/dashboard/billing/${b.id}`,
      })),
    });
  }

  if (orphanBeds.length > 0) {
    riskFlags.push({
      code: "occupied_beds_without_tenant",
      severity: "high",
      count: orphanBeds.length,
      message: `${orphanBeds.length} bed(s) are marked occupied with no active tenant, so occupancy is overstated`,
      sample: orphanBeds.slice(0, SAMPLE_LIMIT).map((b) => ({
        id: b.id,
        label: `${b.propertyName} — ${b.roomNumber}-${b.bedNumber}`,
        href: `/dashboard/properties/${b.propertyId}/structure`,
      })),
    });
  }

  if (bedlessTenants.length > 0) {
    riskFlags.push({
      code: "active_tenants_without_bed",
      severity: "medium",
      count: bedlessTenants.length,
      message: `${bedlessTenants.length} active tenant(s) hold no bed, so they have no rent source to bill from`,
      sample: bedlessTenants.slice(0, SAMPLE_LIMIT).map((t) => ({
        id: t.id,
        label: `${t.name} — ${t.propertyName}`,
        href: `/dashboard/tenants/${t.id}`,
      })),
    });
  }

  // Only meaningful once there is somebody to bill; a brand new account is
  // covered by the activation checklist instead.
  const sinceLastBill = daysSince(billSpanRow.last);
  if (portfolio.activeTenants > 0 && (sinceLastBill === null || sinceLastBill > BILLING_STALLED_DAYS)) {
    riskFlags.push({
      code: "billing_stalled",
      severity: "high",
      count: sinceLastBill ?? 0,
      message:
        sinceLastBill === null
          ? `${portfolio.activeTenants} active tenant(s) and no bill has ever been raised`
          : `No bill raised in ${sinceLastBill} days, with ${portfolio.activeTenants} active tenant(s)`,
      sample: [],
    });
  }

  if (propertiesWithoutUpi.length > 0) {
    riskFlags.push({
      code: "missing_upi_vpa",
      severity: "medium",
      count: propertiesWithoutUpi.length,
      message: `${propertiesWithoutUpi.length} propert(y/ies) have no UPI VPA, so tenants cannot pay digitally`,
      sample: propertiesWithoutUpi.slice(0, SAMPLE_LIMIT).map((p) => ({
        id: p.id,
        label: p.name,
        href: `/dashboard/properties/${p.id}`,
      })),
    });
  }

  const overview: OwnerOverview = {
    owner: identity,
    portfolio,
    billing,
    activation,
    riskFlags,
  };

  res.json(overview);
});

export default router;
