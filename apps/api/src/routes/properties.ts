import { Router } from "express";
import { z } from "zod";
import { db, property } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { param } from "../lib/http";

const router = Router();

const createPropertySchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  electricityMode: z.enum(["flat", "meter"]).default("flat"),
  electricityRatePerUnit: z.number().optional(),
});

const updatePropertySchema = createPropertySchema.partial();

// Get all properties for owner
router.get("/", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const properties = await db
      .select()
      .from(property)
      .where(eq(property.ownerId, req.ownerId!));

    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// Get single property
router.get("/:id", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const [prop] = await db
      .select()
      .from(property)
      .where(
        and(
          eq(property.id, param(req, "id")),
          eq(property.ownerId, req.ownerId!)
        )
      )
      .limit(1);

    if (!prop) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json(prop);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch property" });
  }
});

// Create property
router.post("/", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const body = createPropertySchema.parse(req.body);

    const [newProperty] = await db
      .insert(property)
      .values({
        ...body,
        ownerId: req.ownerId!,
      })
      .returning();

    res.status(201).json(newProperty);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create property" });
  }
});

// Update property
router.put("/:id", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const body = updatePropertySchema.parse(req.body);

    const [updated] = await db
      .update(property)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(property.id, param(req, "id")),
          eq(property.ownerId, req.ownerId!)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update property" });
  }
});

// Delete property
router.delete("/:id", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const [deleted] = await db
      .delete(property)
      .where(
        and(
          eq(property.id, param(req, "id")),
          eq(property.ownerId, req.ownerId!)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json({ message: "Property deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete property" });
  }
});

export default router;
