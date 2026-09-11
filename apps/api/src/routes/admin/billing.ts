import { Router } from "express";
import { z } from "zod";
import { db, property, tenant, bill, payment } from "@pgkhata/db";
import { eq, desc, gt, isNotNull, isNull, lte } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { aggregate, param } from "../../lib/http";
import { captureBefore } from "../../lib/audit";
import { syncBillTotals } from "../../lib/bill-totals";
import { pagination, sendPageWithTotal } from "../../lib/pagination";
import {
  booleanParam,
  countAll,
  every,
  idParam,
  parseFilters,
} from "../../lib/admin-list";

/**
 * `PATCH /bills/:billId` and `POST /bills/:billId/void` used to live here and
 * were removed.
 *
 * The PATCH accepted `totalAmount`, `paidAmount`, `balance` and `status` as four
 * independent numbers, so it could — and did — write a bill whose paid amount
 * disagreed with its own payment ledger, with `status` frozen at whatever the
 * caller typed. The void set `voidedAt` without re-deriving balance or status,
 * leaving a voided bill still counted as outstanding.
 *
 * Both are replaced by `POST /bills/:billId/recompute`, which derives the
 * totals from the payments rather than accepting them, and by the owner-side
 * void behind impersonation.
 */

const router = Router();

const billColumns = {
  id: bill.id,
  tenantId: bill.tenantId,
  billMonth: bill.billMonth,
  totalAmount: bill.totalAmount,
  paidAmount: bill.paidAmount,
  balance: bill.balance,
  status: bill.status,
  approved: bill.approved,
  voidedAt: bill.voidedAt,
  createdAt: bill.createdAt,
  tenantName: tenant.name,
  propertyName: property.name,
};

/**
 * The list also returns the ids the filters accept, so a row the admin is
 * looking at can be turned into "show me everything else for this property"
 * without a second lookup. Both come off joins the list already performs.
 */
const billListColumns = {
  ...billColumns,
  propertyId: tenant.propertyId,
  ownerId: property.ownerId,
};

const billFilterSchema = z.object({
  ownerId: idParam.optional(),
  propertyId: idParam.optional(),
  tenantId: idParam.optional(),
  billMonth: z.string().regex(/^\d{4}-\d{2}$/, "billMonth must be YYYY-MM").optional(),
  // The full set `syncBillTotals` writes, "voided" included — it is a status
  // value, not only a timestamp, so leaving it out would make the filter unable
  // to name a state the column really holds.
  status: z.enum(["pending", "partial", "paid", "overdue", "voided"]).optional(),
  approved: booleanParam.optional(),
  voided: booleanParam.optional(),
  hasBalance: booleanParam.optional(),
});

/**
 * Platform-wide bill list, one page at a time.
 *
 * There is no free-text search: a bill has no name. Every question support
 * actually arrives with ("this owner's unapproved March bills", "everything
 * still outstanding for this tenant") is a combination of the identifiers and
 * the three booleans below, all of which are exact.
 *
 * `voided` and `hasBalance` are derived rather than stored: a bill is voided
 * when `voidedAt` is set, and outstanding when `balance > 0`. Reading them off
 * `status` instead would be wrong, because a voided bill keeps whatever status
 * it had when it was voided.
 */
router.get("/bills", async (req, res) => {
  const filters = parseFilters(req, res, billFilterSchema);
  if (!filters) return;
  const page = pagination(req);

  const where = every(
    // The owner hop is `bill -> tenant -> property.ownerId`; there is no
    // ownerId on the bill itself and there must not be one.
    filters.ownerId ? eq(property.ownerId, filters.ownerId) : undefined,
    filters.propertyId ? eq(tenant.propertyId, filters.propertyId) : undefined,
    filters.tenantId ? eq(bill.tenantId, filters.tenantId) : undefined,
    filters.billMonth ? eq(bill.billMonth, filters.billMonth) : undefined,
    filters.status ? eq(bill.status, filters.status) : undefined,
    filters.approved === undefined ? undefined : eq(bill.approved, filters.approved),
    filters.voided === undefined
      ? undefined
      : filters.voided
        ? isNotNull(bill.voidedAt)
        : isNull(bill.voidedAt),
    filters.hasBalance === undefined
      ? undefined
      : filters.hasBalance
        ? gt(bill.balance, 0)
        : lte(bill.balance, 0),
  );

  const [bills, totalRows] = await Promise.all([
    db
      .select(billListColumns)
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .where(where)
      .orderBy(desc(bill.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: countAll })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .where(where),
  ]);

  sendPageWithTotal(res, bills, page, aggregate(totalRows, { total: 0 }).total);
});

router.get("/bills/:billId", async (req: AuthenticatedRequest, res) => {
  const billId = param(req, "billId");

  const [b] = await db
    .select(billColumns)
    .from(bill)
    .leftJoin(tenant, eq(bill.tenantId, tenant.id))
    .leftJoin(property, eq(tenant.propertyId, property.id))
    .where(eq(bill.id, billId))
    .limit(1);

  if (!b) return res.status(404).json({ error: "Bill not found" });
  res.json(b);
});

/** Bill detail with line items and payment history. */
router.get("/bills/:billId/details", async (req: AuthenticatedRequest, res) => {
  const billId = param(req, "billId");

  const [b] = await db
    .select({
      id: bill.id,
      billMonth: bill.billMonth,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      balance: bill.balance,
      status: bill.status,
      approved: bill.approved,
      voidedAt: bill.voidedAt,
      lineItems: bill.lineItems,
      createdAt: bill.createdAt,
    })
    .from(bill)
    .where(eq(bill.id, billId))
    .limit(1);

  if (!b) return res.status(404).json({ error: "Bill not found" });

  const payments = await db
    .select()
    .from(payment)
    .where(eq(payment.billId, billId))
    .orderBy(desc(payment.paymentDate));

  res.json({ ...b, payments });
});

/**
 * Re-derives paid amount, balance and status from the payment ledger, which is
 * the source of truth for all three. It takes no numbers from the caller, so
 * the worst it can do is agree with the payments already recorded — and running
 * it twice changes nothing the second time.
 */
router.post("/bills/:billId/recompute", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const billId = param(req, "billId");

  const [before] = await db
    .select({
      id: bill.id,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      balance: bill.balance,
      status: bill.status,
    })
    .from(bill)
    .where(eq(bill.id, billId))
    .limit(1);

  if (!before) return res.status(404).json({ error: "Bill not found" });
  captureBefore(req, before);

  const result = await syncBillTotals(billId, before.totalAmount);
  res.json({ billId, ...result });
});

export default router;
