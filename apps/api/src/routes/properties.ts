import { Router } from "express";
import { z } from "zod";
import { db, property, bed, room } from "@pgkhata/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { param, aggregate } from "../lib/http";
import { seedElectricityChargeType } from "../lib/charge-types";

const router = Router();

const createPropertySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  address: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  description: z.string().optional(),
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

    if (properties.length === 0) {
      return res.json([]);
    }

    const propertyIds = properties.map((p) => p.id);

    // Get bed counts per property
    const bedCounts = await db
      .select({
        propertyId: room.propertyId,
        totalBeds: sql<number>`count(${bed.id})::int`,
        occupiedBeds: sql<number>`count(case when ${bed.status} = 'occupied' then 1 end)::int`,
      })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(inArray(room.propertyId, propertyIds))
      .groupBy(room.propertyId);

    const bedCountMap = new Map(
      bedCounts.map((bc) => [bc.propertyId, { totalBeds: bc.totalBeds, occupiedBeds: bc.occupiedBeds }])
    );

    const result = properties.map((p) => ({
      ...p,
      totalBeds: bedCountMap.get(p.id)?.totalBeds ?? 0,
      occupiedBeds: bedCountMap.get(p.id)?.occupiedBeds ?? 0,
    }));

    res.json(result);
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

    if (newProperty) {
      // Every property bills electricity today, so the one charge type
      // billing depends on must exist from the start rather than being
      // something an owner has to remember to create.
      await seedElectricityChargeType(newProperty.id);
    }

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

// Get QR code for signup link
router.get("/:id/qr-code", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const [prop] = await db
      .select({ signupToken: property.signupToken })
      .from(property)
      .where(
        and(
          eq(property.id, param(req, "id")),
          eq(property.ownerId, req.ownerId!)
        )
      )
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Property not found" });
    if (!prop.signupToken) {
      return res.status(409).json({ error: "No signup token configured" });
    }

    // Generate QR code as base64 PNG
    // Using a simple QR code generation approach
    const signupUrl = `${process.env.APP_URL || "https://pgkhata.com"}/public/signup/${prop.signupToken}`;

    // For now, return the URL - QR generation will be added when qrcode package is installed
    res.json({
      url: signupUrl,
      token: prop.signupToken,
      message: "Install qrcode package for QR generation",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

export default router;
