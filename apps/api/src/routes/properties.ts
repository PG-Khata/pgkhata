import { Router } from "express";
import { z } from "zod";
import { db, property, bed, room, tenant, complaint } from "@pgkhata/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { param, aggregate } from "../lib/http";
import { seedElectricityChargeType } from "../lib/charge-types";
import { pagination, sendPage } from "../lib/pagination";

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
  upiVpa: z.string().max(100).optional(),
});

const updatePropertySchema = createPropertySchema.partial();

// Get all properties for owner
router.get("/", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const page = pagination(req);
    const properties = await db
      .select()
      .from(property)
      .where(eq(property.ownerId, req.ownerId!))
      .limit(page.limit)
      .offset(page.offset);

    if (properties.length === 0) {
      return sendPage(res, [], page);
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

    sendPage(res, result, page);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// Get QR code for signup link
router.get("/:id/qr-code", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "id");

    let [prop] = await db
      .select({ signupToken: property.signupToken })
      .from(property)
      .where(
        and(
          eq(property.id, propertyId),
          eq(property.ownerId, req.ownerId!)
        )
      )
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Auto-generate signup token if it doesn't exist
    if (!prop.signupToken) {
      const { randomUUID } = await import("crypto");
      const newToken = randomUUID();

      const [updated] = await db
        .update(property)
        .set({ signupToken: newToken })
        .where(eq(property.id, propertyId))
        .returning({ signupToken: property.signupToken });

      if (!updated) {
        return res.status(500).json({ error: "Failed to generate signup token" });
      }

      prop = { signupToken: updated.signupToken };
    }

    if (!process.env.APP_URL) {
      throw new Error("APP_URL environment variable is required");
    }

    const signupUrl = `${process.env.APP_URL}/public/signup/${prop.signupToken}`;

    res.json({
      url: signupUrl,
      token: prop.signupToken,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// Get complaint QR code
router.get("/:id/complaint-qr", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "id");

    let [prop] = await db
      .select({ complaintToken: property.complaintToken })
      .from(property)
      .where(
        and(
          eq(property.id, propertyId),
          eq(property.ownerId, req.ownerId!)
        )
      )
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Auto-generate complaint token if it doesn't exist
    if (!prop.complaintToken) {
      const { randomUUID } = await import("crypto");
      const newToken = randomUUID();

      const [updated] = await db
        .update(property)
        .set({ complaintToken: newToken })
        .where(eq(property.id, propertyId))
        .returning({ complaintToken: property.complaintToken });

      if (!updated) {
        return res.status(500).json({ error: "Failed to generate complaint token" });
      }

      prop = { complaintToken: updated.complaintToken };
    }

    if (!process.env.APP_URL) {
      throw new Error("APP_URL environment variable is required");
    }

    const complaintUrl = `${process.env.APP_URL}/public/complaint/${prop.complaintToken}`;

    res.json({
      url: complaintUrl,
      token: prop.complaintToken,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate complaint QR code" });
  }
});

// Get complaints for a property
router.get("/:id/complaints", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const page = pagination(req);
    const propertyId = param(req, "id");

    // Verify property belongs to owner
    const [prop] = await db
      .select({ id: property.id })
      .from(property)
      .where(
        and(
          eq(property.id, propertyId),
          eq(property.ownerId, req.ownerId!)
        )
      )
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Property not found" });

    const complaints = await db
      .select({
        id: complaint.id,
        propertyId: complaint.propertyId,
        subject: complaint.subject,
        description: complaint.description,
        roomNumber: complaint.roomNumber,
        category: complaint.category,
        priority: complaint.priority,
        status: complaint.status,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantEmail: tenant.email,
      })
      .from(complaint)
      .leftJoin(tenant, eq(complaint.tenantId, tenant.id))
      .where(eq(complaint.propertyId, propertyId))
      .orderBy(
        sql`CASE
          WHEN ${complaint.status} = 'open' THEN 1
          WHEN ${complaint.status} = 'in_progress' THEN 2
          WHEN ${complaint.status} = 'resolved' THEN 3
          ELSE 4
        END`,
        complaint.createdAt
      )
      .limit(page.limit)
      .offset(page.offset);

    sendPage(res, complaints, page);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// Update complaint status
router.patch("/:id/complaints/:complaintId", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "id");
    const complaintId = param(req, "complaintId");
    const { status } = req.body;

    const validStatuses = ["open", "in_progress", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    // Verify property belongs to owner
    const [prop] = await db
      .select({ id: property.id })
      .from(property)
      .where(
        and(
          eq(property.id, propertyId),
          eq(property.ownerId, req.ownerId!)
        )
      )
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Property not found" });

    const [updated] = await db
      .update(complaint)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(complaint.id, complaintId),
          eq(complaint.propertyId, propertyId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update complaint" });
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
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
