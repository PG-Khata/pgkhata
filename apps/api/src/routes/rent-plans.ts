import { Router } from "express";
import { z } from "zod";
import { db, rentPlan, room } from "@pgkhata/db";
import { eq, and, asc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, aggregate } from "../lib/http";

const router = Router({ mergeParams: true });

const createPlanSchema = z.object({
  name: z.string().min(1).max(50),
  monthlyRent: z.number().int().min(0),
  securityDeposit: z.number().int().min(0).nullable().optional(),
  dueDay: z.number().int().min(1).max(28).default(1),
  lateFeePerDay: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
  minStayMonths: z.number().int().min(0).nullable().optional(),
  noticePeriodDays: z.number().int().min(0).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

const updatePlanSchema = createPlanSchema.partial();

router.use(requireAuth, requireOwner, requireProperty);

// List plans, with how many rooms use each — an owner deactivating a plan
// needs to know its blast radius before doing it.
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const plans = await db
      .select({
        plan: rentPlan,
        roomCount: db.$count(room, eq(room.rentPlanId, rentPlan.id)),
      })
      .from(rentPlan)
      .where(eq(rentPlan.propertyId, req.propertyId!))
      .orderBy(asc(rentPlan.name));

    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rent plans" });
  }
});

router.get("/:planId", async (req: AuthenticatedRequest, res) => {
  try {
    const [plan] = await db
      .select()
      .from(rentPlan)
      .where(
        and(eq(rentPlan.id, param(req, "planId")), eq(rentPlan.propertyId, req.propertyId!)),
      )
      .limit(1);

    if (!plan) return res.status(404).json({ error: "Rent plan not found" });

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rent plan" });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createPlanSchema.parse(req.body);

    const [created] = await db
      .insert(rentPlan)
      .values({ ...body, propertyId: req.propertyId! })
      .onConflictDoNothing({ target: [rentPlan.propertyId, rentPlan.name] })
      .returning();

    if (!created) {
      return res.status(409).json({ error: "A rent plan with this name already exists" });
    }

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create rent plan" });
  }
});

router.put("/:planId", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updatePlanSchema.parse(req.body);
    const planId = param(req, "planId");

    // Deactivating (or editing) a plan changes only future billing runs.
    // Bills store their own computed rentAmount and never reference the plan
    // id, so nothing already issued moves when this row changes.
    const [updated] = await db
      .update(rentPlan)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(rentPlan.id, planId), eq(rentPlan.propertyId, req.propertyId!)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Rent plan not found" });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update rent plan" });
  }
});

router.delete("/:planId", async (req: AuthenticatedRequest, res) => {
  try {
    const planId = param(req, "planId");

    const [plan] = await db
      .select({ id: rentPlan.id })
      .from(rentPlan)
      .where(and(eq(rentPlan.id, planId), eq(rentPlan.propertyId, req.propertyId!)))
      .limit(1);

    if (!plan) return res.status(404).json({ error: "Rent plan not found" });

    const { roomCount } = aggregate(
      await db
        .select({ roomCount: db.$count(room, eq(room.rentPlanId, planId)) })
        .from(rentPlan)
        .where(eq(rentPlan.id, planId)),
      { roomCount: 0 },
    );

    if (roomCount > 0) {
      return res.status(409).json({
        error: `Plan still used by ${roomCount} room${roomCount === 1 ? "" : "s"}. Reassign them first.`,
      });
    }

    await db.delete(rentPlan).where(eq(rentPlan.id, planId));

    res.json({ message: "Rent plan deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete rent plan" });
  }
});

export default router;
