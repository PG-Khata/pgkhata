import { Router } from "express";
import { z } from "zod";
import { db, property, tenant, bill, payment } from "@pgkhata/db";
import { eq, desc, gte, lte } from "drizzle-orm";
import { aggregate } from "../../lib/http";
import { pagination, sendPageWithTotal } from "../../lib/pagination";
import {
  countAll,
  dateParam,
  dateRange,
  every,
  idParam,
  parseFilters,
} from "../../lib/admin-list";

/**
 * `PUT /payments/:paymentId` and `DELETE /payments/:paymentId` used to live
 * here and were removed.
 *
 * Neither called `syncBillTotals`, so editing or deleting a payment left the
 * bill's `paidAmount`, `balance` and `status` describing a ledger that no longer
 * existed — the bill said paid while the money was gone. The owner routes do
 * the write and the resync in one transaction; support reaches them through
 * impersonation. A bill that has already drifted is repaired with
 * `POST /bills/:billId/recompute`.
 */

const router = Router();

const paymentColumns = {
  id: payment.id,
  billId: payment.billId,
  amount: payment.amount,
  paymentDate: payment.paymentDate,
  method: payment.method,
  notes: payment.notes,
  createdAt: payment.createdAt,
  tenantName: tenant.name,
  billMonth: bill.billMonth,
  // Added alongside the filters that accept them, so a row can be pivoted into
  // "the rest of this property's collections" without another round trip.
  tenantId: bill.tenantId,
  propertyId: tenant.propertyId,
  ownerId: property.ownerId,
  propertyName: property.name,
};

/** A rupee bound on the amount filter; only this list has one. */
const amountParam = z.coerce.number().int().min(0);

const paymentFilterSchema = z
  .object({
    /**
     * There is no payment gateway anywhere in this product: every rupee is
     * collected out of band and typed in afterwards. That makes `method` the
     * only signal that exists about *how* owners actually get paid, and the
     * cash/UPI split is the one number worth watching — it is the difference
     * between an owner who could be moved onto digital collection and one who
     * cannot.
     */
    method: z.enum(["cash", "upi", "bank_transfer", "advance", "other"]).optional(),
    paidFrom: dateParam.optional(),
    paidTo: dateParam.optional(),
    ownerId: idParam.optional(),
    propertyId: idParam.optional(),
    amountMin: amountParam.optional(),
    amountMax: amountParam.optional(),
  })
  .refine(
    (f) => f.amountMin === undefined || f.amountMax === undefined || f.amountMin <= f.amountMax,
    { message: "amountMin must not exceed amountMax", path: ["amountMin"] },
  )
  .refine(
    (f) => f.paidFrom === undefined || f.paidTo === undefined || f.paidFrom <= f.paidTo,
    { message: "paidFrom must not be after paidTo", path: ["paidFrom"] },
  );

/**
 * Platform-wide payment list, one page at a time.
 *
 * Ranges are rejected when inverted rather than silently returning nothing: an
 * empty admin table is indistinguishable from "no payments that week", and a
 * swapped date pair is the most likely way to get one.
 */
router.get("/payments", async (req, res) => {
  const filters = parseFilters(req, res, paymentFilterSchema);
  if (!filters) return;
  const page = pagination(req);

  const where = every(
    filters.method ? eq(payment.method, filters.method) : undefined,
    // `paymentDate` is when the money changed hands; `createdAt` is when
    // someone got round to typing it in. Reconciliation always means the former.
    dateRange(payment.paymentDate, filters.paidFrom, filters.paidTo),
    // Owner reached through `bill -> tenant -> property.ownerId`, the only
    // column carrying an owner.
    filters.ownerId ? eq(property.ownerId, filters.ownerId) : undefined,
    filters.propertyId ? eq(tenant.propertyId, filters.propertyId) : undefined,
    filters.amountMin === undefined ? undefined : gte(payment.amount, filters.amountMin),
    filters.amountMax === undefined ? undefined : lte(payment.amount, filters.amountMax),
  );

  const [payments, totalRows] = await Promise.all([
    db
      .select(paymentColumns)
      .from(payment)
      .leftJoin(bill, eq(payment.billId, bill.id))
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .where(where)
      .orderBy(desc(payment.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: countAll })
      .from(payment)
      .leftJoin(bill, eq(payment.billId, bill.id))
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .where(where),
  ]);

  sendPageWithTotal(res, payments, page, aggregate(totalRows, { total: 0 }).total);
});

export default router;
