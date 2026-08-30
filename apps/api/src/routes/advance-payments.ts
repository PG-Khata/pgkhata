import { Router } from "express";
import { z } from "zod";
import { db, advancePayment, tenant, bill, payment } from "@pgkhata/db";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, HttpError } from "../lib/http";
import { applyAdvanceToBill } from "../lib/advance-payment";
import { syncBillTotals } from "./payments";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  tenantId: z.string().uuid(),
  amount: z.number().int().min(1),
  date: z.string().transform((str) => new Date(str)).optional(),
  notes: z.string().optional(),
});

const applySchema = z.object({
  billId: z.string().uuid(),
  amount: z.number().int().min(1).optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

/** Proves a tenant belongs to the already-verified property. */
async function ownedTenant(propertyId: string, tenantId: string) {
  const [t] = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, propertyId)))
    .limit(1);
  return t;
}

/** Proves an advance belongs to a tenant of the already-verified property. */
async function ownedAdvance(propertyId: string, advanceId: string) {
  const [row] = await db
    .select({ advance: advancePayment })
    .from(advancePayment)
    .innerJoin(tenant, eq(advancePayment.tenantId, tenant.id))
    .where(and(eq(advancePayment.id, advanceId), eq(tenant.propertyId, propertyId)))
    .limit(1);
  return row?.advance;
}

// List every advance for the property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const advances = await db
      .select({ advance: advancePayment, tenantName: tenant.name })
      .from(advancePayment)
      .innerJoin(tenant, eq(advancePayment.tenantId, tenant.id))
      .where(eq(tenant.propertyId, req.propertyId!))
      .orderBy(desc(advancePayment.date));

    res.json(advances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch advance payments" });
  }
});

// Advances for one tenant
router.get("/tenant/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");
    if (!(await ownedTenant(req.propertyId!, tenantId))) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const advances = await db
      .select()
      .from(advancePayment)
      .where(eq(advancePayment.tenantId, tenantId))
      .orderBy(desc(advancePayment.date));

    res.json(advances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant advance payments" });
  }
});

// Record an advance
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);

    if (!(await ownedTenant(req.propertyId!, body.tenantId))) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const [created] = await db
      .insert(advancePayment)
      .values({
        tenantId: body.tenantId,
        amount: body.amount,
        date: body.date,
        notes: body.notes,
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record advance payment" });
  }
});

/**
 * Applies part or all of an advance to one bill. Reduces the advance's
 * remaining balance and writes a `method: "advance"` row to the payment
 * ledger — payments stay the single source of truth for what a bill has had
 * applied to it, rather than the advance and the bill each tracking their own
 * copy of the same fact.
 */
router.post("/:advanceId/apply", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = applySchema.parse(req.body);
    const advanceId = param(req, "advanceId");

    const advance = await ownedAdvance(req.propertyId!, advanceId);
    if (!advance) return res.status(404).json({ error: "Advance payment not found" });

    const [targetBill] = await db
      .select({ bill: bill })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(eq(bill.id, body.billId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!targetBill) return res.status(404).json({ error: "Bill not found" });

    const decision = applyAdvanceToBill({
      advance,
      billBalance: targetBill.bill.balance,
      requestedAmount: body.amount,
    });

    if (!decision.ok) {
      const messages: Record<typeof decision.reason, string> = {
        forfeited: "Advance has been forfeited and cannot be applied",
        "nothing-available": "No balance remains on this advance",
        "exceeds-available": "Amount exceeds what remains available on this advance",
        "exceeds-bill-balance": "Amount exceeds the bill's outstanding balance",
      };
      return res.status(409).json({ error: messages[decision.reason] });
    }

    const result = await db.transaction(async (tx) => {
      const [updatedAdvance] = await tx
        .update(advancePayment)
        .set({
          appliedAmount: decision.newAppliedAmount,
          status: decision.newAdvanceStatus,
          updatedAt: new Date(),
        })
        .where(eq(advancePayment.id, advanceId))
        .returning();

      await tx.insert(payment).values({
        billId: body.billId,
        amount: decision.amountApplied,
        paymentDate: new Date(),
        method: "advance",
        notes: `Applied from advance payment ${advanceId}`,
      });

      return updatedAdvance;
    });

    const billStatus = await syncBillTotals(body.billId, targetBill.bill.totalAmount);

    res.json({
      message: `Applied ${decision.amountApplied} from advance to bill`,
      amountApplied: decision.amountApplied,
      advance: result,
      bill: billStatus,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to apply advance payment" });
  }
});

// Forfeit an advance — terminal, no further application possible.
router.post("/:advanceId/forfeit", async (req: AuthenticatedRequest, res) => {
  try {
    const advanceId = param(req, "advanceId");

    const advance = await ownedAdvance(req.propertyId!, advanceId);
    if (!advance) return res.status(404).json({ error: "Advance payment not found" });

    if (advance.status === "forfeited") {
      return res.status(409).json({ error: "Advance is already forfeited" });
    }

    const [updated] = await db
      .update(advancePayment)
      .set({ status: "forfeited", updatedAt: new Date() })
      .where(eq(advancePayment.id, advanceId))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to forfeit advance payment" });
  }
});

export default router;
