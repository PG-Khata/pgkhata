import { Router } from "express";
import { z } from "zod";
import { db, payment, bill, tenant } from "@pgkhata/db";
import { eq, and, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, aggregate } from "../lib/http";

const router = Router({ mergeParams: true });

const recordPaymentSchema = z.object({
  billId: z.string().uuid(),
  amount: z.number().min(1),
  paymentDate: z.string().transform((str) => new Date(str)),
  method: z.enum(["cash", "upi", "bank_transfer", "other"]).optional(),
  notes: z.string().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

/** Recomputes bill totals from the payment ledger, the source of truth. */
async function syncBillTotals(billId: string, totalAmount: number) {
  const { totalPaid } = aggregate(
    await db
      .select({ totalPaid: sql<number>`coalesce(sum(${payment.amount}), 0)` })
      .from(payment)
      .where(eq(payment.billId, billId)),
    { totalPaid: 0 },
  );

  const newBalance = totalAmount - totalPaid;
  const newStatus = newBalance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";

  await db
    .update(bill)
    .set({
      paidAmount: totalPaid,
      balance: Math.max(0, newBalance),
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(bill.id, billId));

  return { totalPaid, balance: newBalance, status: newStatus };
}

// Get payments for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const payments = await db
      .select({
        payment: payment,
        tenantName: tenant.name,
        billMonth: bill.billMonth,
      })
      .from(payment)
      .innerJoin(bill, eq(payment.billId, bill.id))
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(eq(tenant.propertyId, req.propertyId!));

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Record payment
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = recordPaymentSchema.parse(req.body);

    // Verify bill belongs to property
    const [b] = await db
      .select({ bill: bill })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(
        and(eq(bill.id, body.billId), eq(tenant.propertyId, req.propertyId!))
      )
      .limit(1);

    if (!b) return res.status(404).json({ error: "Bill not found" });

    const [newPayment] = await db.insert(payment).values(body).returning();

    await syncBillTotals(body.billId, b.bill.totalAmount);

    res.status(201).json(newPayment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// Delete payment (recalculates bill)
router.delete("/:paymentId", async (req: AuthenticatedRequest, res) => {
  try {
    const [deleted] = await db
      .delete(payment)
      .where(eq(payment.id, param(req, "paymentId")))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Payment not found" });

    const [b] = await db
      .select()
      .from(bill)
      .where(eq(bill.id, deleted.billId))
      .limit(1);

    if (b) {
      await syncBillTotals(b.id, b.totalAmount);
    }

    res.json({ message: "Payment deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

export default router;
