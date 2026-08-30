import { Router } from "express";
import { z } from "zod";
import { db, tenant, room } from "@pgkhata/db";
import { eq, and, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, aggregate } from "../lib/http";

const router = Router({ mergeParams: true });

const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  roomId: z.string().uuid().optional(),
  joiningDate: z.string().transform((str) => new Date(str)),
  monthlyRentOverride: z.number().min(0).optional(),
  deposit: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const updateTenantSchema = createTenantSchema.partial().extend({
  status: z.enum(["active", "vacating", "vacated"]).optional(),
  vacatingDate: z.string().transform((str) => new Date(str)).optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get all tenants for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as string | undefined;

    const where = status
      ? and(eq(tenant.propertyId, req.propertyId!), eq(tenant.status, status))
      : eq(tenant.propertyId, req.propertyId!);

    const tenants = await db.select().from(tenant).where(where);
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// Get single tenant
router.get("/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const [t] = await db
      .select()
      .from(tenant)
      .where(
        and(
          eq(tenant.id, param(req, "tenantId")),
          eq(tenant.propertyId, req.propertyId!)
        )
      )
      .limit(1);

    if (!t) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(t);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

// Create tenant
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createTenantSchema.parse(req.body);

    // Check for duplicate phone
    const [existingPhone] = await db
      .select()
      .from(tenant)
      .where(eq(tenant.phone, body.phone))
      .limit(1);

    if (existingPhone) {
      return res.status(409).json({ error: "Phone number already registered" });
    }

    // If room assigned, check capacity
    if (body.roomId) {
      const [r] = await db
        .select()
        .from(room)
        .where(
          and(eq(room.id, body.roomId), eq(room.propertyId, req.propertyId!))
        )
        .limit(1);

      if (!r) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Count active tenants in room
      const { count } = aggregate(
        await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tenant)
          .where(and(eq(tenant.roomId, body.roomId), eq(tenant.status, "active"))),
        { count: 0 },
      );

      if (count >= r.capacity) {
        return res.status(409).json({ error: "Room is at full capacity" });
      }
    }

    const [newTenant] = await db
      .insert(tenant)
      .values({
        ...body,
        propertyId: req.propertyId!,
      })
      .returning();

    res.status(201).json(newTenant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// Update tenant
router.put("/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updateTenantSchema.parse(req.body);
    const tenantId = param(req, "tenantId");

    // If changing room, check capacity
    if (body.roomId) {
      const [r] = await db
        .select()
        .from(room)
        .where(
          and(eq(room.id, body.roomId), eq(room.propertyId, req.propertyId!))
        )
        .limit(1);

      if (!r) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Count active tenants in room (excluding current tenant)
      const { count } = aggregate(
        await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tenant)
          .where(
            and(
              eq(tenant.roomId, body.roomId),
              eq(tenant.status, "active"),
              sql`${tenant.id} != ${tenantId}`
            )
          ),
        { count: 0 },
      );

      if (count >= r.capacity) {
        return res.status(409).json({ error: "Room is at full capacity" });
      }
    }

    const [updated] = await db
      .update(tenant)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!))
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// Delete tenant
router.delete("/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const [deleted] = await db
      .delete(tenant)
      .where(
        and(
          eq(tenant.id, param(req, "tenantId")),
          eq(tenant.propertyId, req.propertyId!)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({ message: "Tenant deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

export default router;
