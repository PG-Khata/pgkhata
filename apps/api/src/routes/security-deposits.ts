import { Router } from "express";
import { z } from "zod";
import { db, securityDeposit, tenant } from "@pgkhata/db";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { issueRefund, summarizeLiability } from "../lib/security-deposit";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  tenantId: z.string().uuid(),
  amount: z.number().int().min(1),
  promisedDate: z.string().transform((str) => new Date(str)).optional(),
  notes: z.string().optional(),
});

const refundSchema = z.object({
  amount: z.number().int().min(1),
  date: z.string().transform((str) => new Date(str)).optional(),
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

// List every deposit for the property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const deposits = await db
      .select({ deposit: securityDeposit, tenantName: tenant.name })
      .from(securityDeposit)
      .innerJoin(tenant, eq(securityDeposit.tenantId, tenant.id))
      .where(eq(securityDeposit.propertyId, req.propertyId!))
      .orderBy(desc(securityDeposit.createdAt));

    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch security deposits" });
  }
});

/**
 * Reports total held, total refunded, and net liability across the
 * property's deposits. Computed from the same amount/refundAmount fields the
 * per-deposit rows expose, so the report can never disagree with them.
 */
router.get("/liability-report", async (req: AuthenticatedRequest, res) => {
  try {
    const deposits = await db
      .select({ amount: securityDeposit.amount, refundAmount: securityDeposit.refundAmount })
      .from(securityDeposit)
      .where(eq(securityDeposit.propertyId, req.propertyId!));

    res.json(summarizeLiability(deposits));
  } catch (error) {
    res.status(500).json({ error: "Failed to build liability report" });
  }
});

router.get("/:depositId", async (req: AuthenticatedRequest, res) => {
  try {
    const [deposit] = await db
      .select()
      .from(securityDeposit)
      .where(
        and(
          eq(securityDeposit.id, param(req, "depositId")),
          eq(securityDeposit.propertyId, req.propertyId!),
        ),
      )
      .limit(1);

    if (!deposit) return res.status(404).json({ error: "Security deposit not found" });

    res.json(deposit);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch security deposit" });
  }
});

// Record a deposit held for a tenant
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);

    if (!(await ownedTenant(req.propertyId!, body.tenantId))) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const [created] = await db
      .insert(securityDeposit)
      .values({
        tenantId: body.tenantId,
        propertyId: req.propertyId!,
        amount: body.amount,
        promisedDate: body.promisedDate,
        notes: body.notes,
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record security deposit" });
  }
});

// Issue a partial or full refund
router.post("/:depositId/refund", async (req: AuthenticatedRequest, res) => {
  try {
    const body = refundSchema.parse(req.body);
    const depositId = param(req, "depositId");

    const [deposit] = await db
      .select()
      .from(securityDeposit)
      .where(and(eq(securityDeposit.id, depositId), eq(securityDeposit.propertyId, req.propertyId!)))
      .limit(1);

    if (!deposit) return res.status(404).json({ error: "Security deposit not found" });

    const decision = issueRefund({ deposit, requestedAmount: body.amount });

    if (!decision.ok) {
      const messages: Record<typeof decision.reason, string> = {
        "already-refunded": "This deposit has already been fully refunded",
        "invalid-amount": "Refund amount must be positive",
        "exceeds-outstanding": "Refund amount exceeds what remains outstanding",
      };
      return res.status(409).json({ error: messages[decision.reason] });
    }

    const [updated] = await db
      .update(securityDeposit)
      .set({
        refundAmount: decision.newRefundAmount,
        status: decision.newStatus,
        refundDate: body.date ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(securityDeposit.id, depositId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to issue refund" });
  }
});

export default router;
