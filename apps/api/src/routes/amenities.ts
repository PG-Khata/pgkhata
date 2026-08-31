import { Router } from "express";
import { z } from "zod";
import { db, propertyAmenity } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get amenities for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const amenities = await db
      .select()
      .from(propertyAmenity)
      .where(eq(propertyAmenity.propertyId, req.propertyId!));

    res.json(amenities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch amenities" });
  }
});

// Add amenity
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);

    const [created] = await db
      .insert(propertyAmenity)
      .values({ ...body, propertyId: req.propertyId! })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add amenity" });
  }
});

// Update amenity
router.put("/:amenityId", async (req: AuthenticatedRequest, res) => {
  try {
    const amenityId = param(req, "amenityId");
    const body = createSchema.partial().parse(req.body);

    const [updated] = await db
      .update(propertyAmenity)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(propertyAmenity.id, amenityId), eq(propertyAmenity.propertyId, req.propertyId!)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Amenity not found" });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update amenity" });
  }
});

// Delete amenity
router.delete("/:amenityId", async (req: AuthenticatedRequest, res) => {
  try {
    const amenityId = param(req, "amenityId");

    const [deleted] = await db
      .delete(propertyAmenity)
      .where(and(eq(propertyAmenity.id, amenityId), eq(propertyAmenity.propertyId, req.propertyId!)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Amenity not found" });

    res.json({ message: "Amenity deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete amenity" });
  }
});

export default router;
