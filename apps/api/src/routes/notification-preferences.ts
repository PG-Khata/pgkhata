import { Router } from "express";
import { z } from "zod";
import { db, notificationPreference } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  eventType: z.enum([
    "rent_due",
    "rent_overdue",
    "payment_received",
    "tenant_checkin",
    "tenant_checkout",
    "complaint_created",
    "complaint_resolved",
  ]),
  inApp: z.boolean().default(true),
  email: z.boolean().default(true),
  whatsapp: z.boolean().default(false),
});

const updateSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get notification preferences for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const preferences = await db
      .select()
      .from(notificationPreference)
      .where(eq(notificationPreference.propertyId, req.propertyId!));

    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notification preferences" });
  }
});

// Set notification preference
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);

    // Upsert: update if exists, create if not
    const [existing] = await db
      .select({ id: notificationPreference.id })
      .from(notificationPreference)
      .where(
        and(
          eq(notificationPreference.propertyId, req.propertyId!),
          eq(notificationPreference.eventType, body.eventType),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(notificationPreference)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(notificationPreference.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(notificationPreference)
      .values({ ...body, propertyId: req.propertyId! })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to set notification preference" });
  }
});

// Delete notification preference
router.delete("/:preferenceId", async (req: AuthenticatedRequest, res) => {
  try {
    const preferenceId = param(req, "preferenceId");

    const [deleted] = await db
      .delete(notificationPreference)
      .where(
        and(
          eq(notificationPreference.id, preferenceId),
          eq(notificationPreference.propertyId, req.propertyId!),
        ),
      )
      .returning();

    if (!deleted) return res.status(404).json({ error: "Preference not found" });

    res.json({ message: "Preference deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete preference" });
  }
});

export default router;
