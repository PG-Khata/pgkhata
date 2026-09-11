import { Router } from "express";
import { db, property, tenant, bill, payment } from "@pgkhata/db";
import { eq, desc } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { param } from "../../lib/http";
import { captureBefore } from "../../lib/audit";
import { syncBillTotals } from "../../lib/bill-totals";

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

router.get("/bills", async (_req, res) => {
  const bills = await db
    .select(billColumns)
    .from(bill)
    .leftJoin(tenant, eq(bill.tenantId, tenant.id))
    .leftJoin(property, eq(tenant.propertyId, property.id))
    .orderBy(desc(bill.createdAt));

  res.json(bills);
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
