import { Router } from "express";
import { z } from "zod";
import { db, payment, bill, tenant } from "@pgkhata/db";
import { eq, and, sql, asc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, aggregate } from "../lib/http";
import { autoAllocatePayment } from "../lib/auto-allocate";

const router = Router({ mergeParams: true });

const recordPaymentSchema = z.object({
  billId: z.string().uuid(),
  amount: z.number().min(1),
  paymentDate: z.string().transform((str) => new Date(str)),
  method: z.enum(["cash", "upi", "bank_transfer", "advance", "other"]).optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

/** Recomputes bill totals from the payment ledger, the source of truth. */
export async function syncBillTotals(billId: string, totalAmount: number) {
  const { totalPaid } = aggregate(
    await db
      .select({ totalPaid: sql<number>`coalesce(sum(${payment.amount}), 0)::int` })
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

    // Check for duplicate idempotency key
    if (body.idempotencyKey) {
      const [existing] = await db
        .select({ id: payment.id })
        .from(payment)
        .where(
          and(
            eq(payment.billId, body.billId),
            eq(payment.idempotencyKey, body.idempotencyKey)
          )
        )
        .limit(1);

      if (existing) {
        // Payment with this idempotency key already exists - return success
        return res.status(200).json({ message: "Payment already recorded", id: existing.id });
      }
    }

    const [newPayment] = await db.insert(payment).values({
      billId: body.billId,
      amount: body.amount,
      paymentDate: body.paymentDate,
      method: body.method,
      notes: body.notes,
      idempotencyKey: body.idempotencyKey,
    }).returning();

    await syncBillTotals(body.billId, b.bill.totalAmount);

    res.status(201).json(newPayment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// Delete payment (recalculates bill) — scoped to this property.
router.delete("/:paymentId", async (req: AuthenticatedRequest, res) => {
  try {
    const paymentId = param(req, "paymentId");

    // Deleting by id alone previously had no ownership check at all; any
    // authenticated owner could delete any payment on the platform. Prove the
    // payment's bill belongs to a tenant of this property before touching it.
    const [owned] = await db
      .select({ id: payment.id, billId: payment.billId })
      .from(payment)
      .innerJoin(bill, eq(payment.billId, bill.id))
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(eq(payment.id, paymentId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!owned) return res.status(404).json({ error: "Payment not found" });

    await db.delete(payment).where(eq(payment.id, paymentId));

    const [b] = await db
      .select()
      .from(bill)
      .where(eq(bill.id, owned.billId))
      .limit(1);

    if (b) {
      await syncBillTotals(b.id, b.totalAmount);
    }

    res.json({ message: "Payment deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

// Auto-allocate a payment across outstanding bills (oldest first)
router.post("/auto-allocate", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, amount, paymentDate, method, notes } = z
      .object({
        tenantId: z.string().uuid(),
        amount: z.number().min(1),
        paymentDate: z.string().transform((str) => new Date(str)),
        method: z.enum(["cash", "upi", "bank_transfer", "other"]).optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    // Verify tenant belongs to property
    const [t] = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    // Get outstanding bills
    const outstandingBills = await db
      .select({ id: bill.id, balance: bill.balance, billMonth: bill.billMonth })
      .from(bill)
      .where(and(eq(bill.tenantId, tenantId), sql`${bill.balance} > 0`))
      .orderBy(asc(bill.billMonth));

    if (outstandingBills.length === 0) {
      return res.status(409).json({ error: "No outstanding bills" });
    }

    const allocations = autoAllocatePayment(amount, outstandingBills);

    if (allocations.length === 0) {
      return res.status(409).json({ error: "Amount too small to allocate" });
    }

    // Create payments and update bills in a transaction
    const results = await db.transaction(async (tx) => {
      const created = [];
      for (const alloc of allocations) {
        const [p] = await tx
          .insert(payment)
          .values({
            billId: alloc.billId,
            amount: alloc.amount,
            paymentDate,
            method,
            notes: notes ? `Auto-allocated: ${notes}` : "Auto-allocated",
          })
          .returning();
        created.push(p);

        // Sync bill totals
        const [b] = await tx
          .select({ totalAmount: bill.totalAmount })
          .from(bill)
          .where(eq(bill.id, alloc.billId))
          .limit(1);

        if (b) {
          await syncBillTotals(alloc.billId, b.totalAmount);
        }
      }
      return created;
    });

    res.status(201).json({
      message: `Allocated across ${results.length} bills`,
      allocations: results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to auto-allocate payment" });
  }
});

export default router;
