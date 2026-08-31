import { Router } from "express";
import { z } from "zod";
import { db, billingPolicy } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";

const router = Router({ mergeParams: true });

const updateSchema = z.object({
  advanceHandlingMode: z.enum(["manual", "auto_adjust"]).optional(),
  bookingExpiryDays: z.number().min(1).max(30).optional(),
  autoAllocatePayments: z.boolean().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get billing policy for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const [policy] = await db
      .select()
      .from(billingPolicy)
      .where(eq(billingPolicy.propertyId, req.propertyId!))
      .limit(1);

    if (!policy) {
      // Create default policy if none exists
      const [created] = await db
        .insert(billingPolicy)
        .values({ propertyId: req.propertyId! })
        .returning();
      return res.json(created);
    }

    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch billing policy" });
  }
});

// Update billing policy
router.put("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updateSchema.parse(req.body);

    const [existing] = await db
      .select({ id: billingPolicy.id })
      .from(billingPolicy)
      .where(eq(billingPolicy.propertyId, req.propertyId!))
      .limit(1);

    if (!existing) {
      const [created] = await db
        .insert(billingPolicy)
        .values({ ...body, propertyId: req.propertyId! })
        .returning();
      return res.json(created);
    }

    const [updated] = await db
      .update(billingPolicy)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(billingPolicy.propertyId, req.propertyId!))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update billing policy" });
  }
});

export default router;
