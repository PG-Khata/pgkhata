import { Router } from "express";
import { z } from "zod";
import { db, payment, bill, tenant } from "@pgkhata/db";
import { eq, and, sql, asc, or, like } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, HttpError } from "../lib/http";
import { autoAllocatePayment } from "../lib/auto-allocate";
import { syncBillTotals } from "../lib/bill-totals";
import { formatDateOnly } from "../lib/due-date";
import { pagination, sendPage } from "../lib/pagination";

const router = Router({ mergeParams: true });

const recordPaymentSchema = z.object({
  billId: z.string().uuid(),
  amount: z.number().min(1),
  paymentDate: z.string().transform((str) => new Date(str)),
  method: z.enum(["cash", "upi", "bank_transfer", "advance", "other"]).optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().uuid(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get payments for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const page = pagination(req);
    const payments = await db
      .select({
        payment: payment,
        tenantName: tenant.name,
        billMonth: bill.billMonth,
      })
      .from(payment)
      .innerJoin(bill, eq(payment.billId, bill.id))
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(eq(tenant.propertyId, req.propertyId!))
      .limit(page.limit)
      .offset(page.offset);

    sendPage(res, payments, page);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Record payment — wrapped in transaction for idempotency and consistency
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = recordPaymentSchema.parse(req.body);

    const result = await db.transaction(async (tx) => {
      // Serialize retries carrying the same key even before a payment row
      // exists; the waiter then observes and returns the committed original.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${body.idempotencyKey}))`);
      const [existing] = await tx
        .select({ payment, propertyId: tenant.propertyId })
        .from(payment)
        .innerJoin(bill, eq(payment.billId, bill.id))
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(eq(payment.idempotencyKey, body.idempotencyKey))
        .limit(1);

      if (existing) {
        if (existing.propertyId !== req.propertyId!) throw new HttpError(409, "Idempotency key already used");
        const samePayload = existing.payment.billId === body.billId
          && existing.payment.amount === body.amount
          && formatDateOnly(existing.payment.paymentDate) === formatDateOnly(body.paymentDate)
          && (existing.payment.method ?? null) === (body.method ?? null)
          && (existing.payment.notes ?? null) === (body.notes ?? null);
        if (!samePayload) throw new HttpError(409, "Idempotency key was used with different payment details");
        return { type: "duplicate" as const, id: existing.payment.id };
      }

      // Serializes every competing payment for this bill. The second request
      // sees the first request's newly reduced balance before it can insert.
      const [locked] = await tx
        .select({ bill })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(and(eq(bill.id, body.billId), eq(tenant.propertyId, req.propertyId!)))
        .for("update")
        .limit(1);
      if (!locked) throw new HttpError(404, "Bill not found");
      if (locked.bill.voidedAt) throw new HttpError(409, "Voided bills cannot accept payments");
      if (body.amount > locked.bill.balance) throw new HttpError(409, "Payment exceeds bill balance");

      const [newPayment] = await tx.insert(payment).values({
        billId: body.billId,
        amount: body.amount,
        paymentDate: body.paymentDate,
        method: body.method,
        notes: body.notes,
        idempotencyKey: body.idempotencyKey,
      }).returning();

      await syncBillTotals(body.billId, locked.bill.totalAmount, tx);

      return { type: "created" as const, payment: newPayment };
    });

    if (result.type === "duplicate") {
      return res.status(200).json({ message: "Payment already recorded", id: result.id });
    }

    res.status(201).json(result.payment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (error instanceof HttpError) return next(error);
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
router.post("/auto-allocate", async (req: AuthenticatedRequest, res, next) => {
  try {
    const { tenantId, amount, paymentDate, method, notes, idempotencyKey } = z
      .object({
        tenantId: z.string().uuid(),
        amount: z.number().min(1),
        paymentDate: z.string().transform((str) => new Date(str)),
        method: z.enum(["cash", "upi", "bank_transfer", "other"]).optional(),
        notes: z.string().optional(),
        idempotencyKey: z.string().uuid(),
      })
      .parse(req.body);

    // Verify tenant belongs to property
    const [t] = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    const results = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${idempotencyKey}))`);
      const existing = await tx
        .select({ payment })
        .from(payment)
        .innerJoin(bill, eq(payment.billId, bill.id))
        .where(and(eq(bill.tenantId, tenantId), or(
          eq(payment.idempotencyKey, idempotencyKey),
          like(payment.idempotencyKey, `${idempotencyKey}:%`),
        )));
      if (existing.length > 0) {
        const sameRequest = existing.every((row: { payment: typeof payment.$inferSelect }) =>
          row.payment.notes?.startsWith(`Auto-allocated [${idempotencyKey}]`),
        ) && existing.reduce((sum: number, row: { payment: typeof payment.$inferSelect }) => sum + row.payment.amount, 0) === amount;
        if (!sameRequest) throw new HttpError(409, "Idempotency key was used with different allocation details");
        return existing.map((row: { payment: typeof payment.$inferSelect }) => row.payment);
      }

      const outstandingBills = await tx
        .select({ id: bill.id, balance: bill.balance, billMonth: bill.billMonth, totalAmount: bill.totalAmount })
        .from(bill)
        .where(and(eq(bill.tenantId, tenantId), sql`${bill.balance} > 0`, sql`${bill.voidedAt} is null`))
        .orderBy(asc(bill.billMonth))
        .for("update");
      if (outstandingBills.length === 0) throw new HttpError(409, "No outstanding bills");
      const totalOutstanding = outstandingBills.reduce((sum, row) => sum + row.balance, 0);
      if (amount > totalOutstanding) throw new HttpError(409, "Payment exceeds total outstanding balance");
      const allocations = autoAllocatePayment(amount, outstandingBills);
      if (allocations.length === 0) throw new HttpError(409, "Amount too small to allocate");

      const created = [];
      for (const [index, alloc] of allocations.entries()) {
        const [p] = await tx
          .insert(payment)
          .values({
            billId: alloc.billId,
            amount: alloc.amount,
            paymentDate,
            method,
            notes: `Auto-allocated [${idempotencyKey}]${notes ? `: ${notes}` : ""}`,
            idempotencyKey: index === 0 ? idempotencyKey : `${idempotencyKey}:${index}`,
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
          await syncBillTotals(alloc.billId, b.totalAmount, tx);
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to auto-allocate payment" });
  }
});

export default router;
