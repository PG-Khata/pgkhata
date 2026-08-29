import { Router } from "express";
import { z } from "zod";
import { db, payment, bill, tenant, property } from "@pgkhata/db";
import { eq, and, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";

const router = Router({ mergeParams: true });

const recordPaymentSchema = z.object({
  billId: z.string().uuid(),
  amount: z.number().min(1),
  paymentDate: z.string().transform((str) => new Date(str)),
  method: z.enum(["cash", "upi", "bank_transfer", "other"]).optional(),
  notes: z.string().optional(),
});

async function verifyPropertyOwnership(req: AuthenticatedRequest, res: any, next: any) {
  const [prop] = await db
    .select()
    .from(property)
    .where(and(eq(property.id, req.params.propertyId), eq(property.ownerId, req.ownerId!)))
    .limit(1);
  if (!prop) return res.status(404).json({ error: "Property not found" });
  next();
}

// Get payments for property
router.get("/", requireAuth, requireOwner, verifyPropertyOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const payments = await db
      .select({
        payment: payment,
        tenantName: tenant.name,
        billMonth: bill.billMonth,
      })
      .from(payment)
      .leftJoin(bill, eq(payment.billId, bill.id))
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(eq(tenant.propertyId, req.params.propertyId));
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Record payment
router.post("/", requireAuth, requireOwner, verifyPropertyOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const body = recordPaymentSchema.parse(req.body);

    // Verify bill belongs to property
    const [b] = await db
      .select({ bill: bill, tenant: tenant })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(eq(bill.id, body.billId), eq(tenant.propertyId, req.params.propertyId)))
      .limit(1);

    if (!b) return res.status(404).json({ error: "Bill not found" });

    // Record payment
    const [newPayment] = await db
      .insert(payment)
      .values(body)
      .returning();

    // Update bill totals (source of truth)
    const [{ totalPaid }] = await db
      .select({ totalPaid: sql<number>`coalesce(sum(${payment.amount}), 0)` })
      .from(payment)
      .where(eq(payment.billId, body.billId));

    const newBalance = b.bill.totalAmount - totalPaid;
    const newStatus = newBalance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";

    await db
      .update(bill)
      .set({
        paidAmount: totalPaid,
        balance: Math.max(0, newBalance),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(bill.id, body.billId));

    res.status(201).json(newPayment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// Delete payment (recalculates bill)
router.delete("/:paymentId", requireAuth, requireOwner, verifyPropertyOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const [deleted] = await db
      .delete(payment)
      .where(eq(payment.id, req.params.paymentId))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Payment not found" });

    // Recalculate bill
    const [b] = await db
      .select()
      .from(bill)
      .where(eq(bill.id, deleted.billId))
      .limit(1);

    if (b) {
      const [{ totalPaid }] = await db
        .select({ totalPaid: sql<number>`coalesce(sum(${payment.amount}), 0)` })
        .from(payment)
        .where(eq(payment.billId, b.id));

      const newBalance = b.totalAmount - totalPaid;
      const newStatus = newBalance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";

      await db
        .update(bill)
        .set({
          paidAmount: totalPaid,
          balance: Math.max(0, newBalance),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(bill.id, b.id));
    }

    res.json({ message: "Payment deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

export default router;
