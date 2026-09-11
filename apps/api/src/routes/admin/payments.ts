import { Router } from "express";
import { db, tenant, bill, payment } from "@pgkhata/db";
import { eq, desc } from "drizzle-orm";

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

router.get("/payments", async (_req, res) => {
  const payments = await db
    .select({
      id: payment.id,
      billId: payment.billId,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      method: payment.method,
      notes: payment.notes,
      createdAt: payment.createdAt,
      tenantName: tenant.name,
      billMonth: bill.billMonth,
    })
    .from(payment)
    .leftJoin(bill, eq(payment.billId, bill.id))
    .leftJoin(tenant, eq(bill.tenantId, tenant.id))
    .orderBy(desc(payment.createdAt));

  res.json(payments);
});

export default router;
