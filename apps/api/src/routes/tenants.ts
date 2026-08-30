import { Router } from "express";
import { z } from "zod";
import { db, tenant, room, bed } from "@pgkhata/db";
import { eq, and, asc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, HttpError } from "../lib/http";
import {
  assignTenantToBed,
  vacateTenantBed,
} from "../lib/tenant-assignment";

const router = Router({ mergeParams: true });

const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  /** Precise target, from the structure view. */
  bedId: z.string().uuid().optional(),
  /** Older shape: name a room and the first vacant bed in it is used. */
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

const assignSchema = z
  .object({
    bedId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
  })
  .refine((value) => value.bedId || value.roomId, {
    message: "Provide a bed or a room to assign",
  });

router.use(requireAuth, requireOwner, requireProperty);

/** Tenants with the bed and room they hold, for the list and detail views. */
function tenantSelection() {
  return {
    tenant: tenant,
    bedNumber: bed.number,
    roomNumber: room.number,
  };
}

// Get all tenants for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as string | undefined;

    const where = status
      ? and(eq(tenant.propertyId, req.propertyId!), eq(tenant.status, status))
      : eq(tenant.propertyId, req.propertyId!);

    const tenants = await db
      .select(tenantSelection())
      .from(tenant)
      .leftJoin(bed, eq(tenant.bedId, bed.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .where(where)
      .orderBy(asc(tenant.name));

    res.json(
      tenants.map((row) => ({
        ...row.tenant,
        bedNumber: row.bedNumber,
        roomNumber: row.roomNumber,
      })),
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// Get single tenant
router.get("/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const [row] = await db
      .select(tenantSelection())
      .from(tenant)
      .leftJoin(bed, eq(tenant.bedId, bed.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .where(
        and(
          eq(tenant.id, param(req, "tenantId")),
          eq(tenant.propertyId, req.propertyId!),
        ),
      )
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({
      ...row.tenant,
      bedNumber: row.bedNumber,
      roomNumber: row.roomNumber,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

// Create tenant, optionally assigning a bed straight away
router.post("/", async (req: AuthenticatedRequest, res, next) => {
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

    const { bedId, roomId, ...fields } = body;

    const [newTenant] = await db
      .insert(tenant)
      .values({ ...fields, propertyId: req.propertyId! })
      .returning();

    if (!newTenant) {
      return res.status(500).json({ error: "Failed to create tenant" });
    }

    // Assignment is a separate transactional step so a refused bed cannot
    // leave a half-created tenant, and so both request shapes share one path.
    if (bedId || roomId) {
      try {
        const outcome = await assignTenantToBed(req.propertyId!, newTenant.id, {
          bedId,
          roomId,
        });

        return res.status(201).json({
          ...newTenant,
          bedId: outcome.bedId,
          roomId: outcome.roomId,
          bedNumber: outcome.bedNumber,
          roomNumber: outcome.roomNumber,
        });
      } catch (error) {
        // Do not keep a tenant who could not be placed where the owner asked.
        await db.delete(tenant).where(eq(tenant.id, newTenant.id));
        throw error;
      }
    }

    res.status(201).json(newTenant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

/** Put a tenant in a specific bed, or the first vacant bed of a room. */
router.post("/:tenantId/assign-bed", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = assignSchema.parse(req.body);
    const tenantId = param(req, "tenantId");

    const [target] = await db
      .select({ id: tenant.id, status: tenant.status })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Tenant not found" });

    if (target.status === "vacated") {
      return res
        .status(409)
        .json({ error: "Tenant has vacated. Reactivate before assigning a bed." });
    }

    const outcome = await assignTenantToBed(req.propertyId!, tenantId, body);

    res.json({
      message: `Assigned to bed ${outcome.roomNumber}-${outcome.bedNumber}`,
      ...outcome,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to assign bed" });
  }
});

/** Release the bed a tenant holds without ending the tenancy. */
router.post("/:tenantId/vacate-bed", async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await vacateTenantBed(req.propertyId!, param(req, "tenantId"));

    res.json({
      message: result.freedBedId ? "Bed released" : "Tenant held no bed",
      ...result,
    });
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to release bed" });
  }
});

// Update tenant
router.put("/:tenantId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = updateTenantSchema.parse(req.body);
    const tenantId = param(req, "tenantId");

    const [existing] = await db
      .select()
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const { bedId, roomId, ...fields } = body;

    // A tenant who has vacated holds no bed. Free it in the same request so
    // occupancy cannot keep counting them.
    const vacating = fields.status === "vacated" && existing.status !== "vacated";

    const [updated] = await db
      .update(tenant)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .returning();

    if (vacating) {
      await vacateTenantBed(req.propertyId!, tenantId);
    } else if (bedId || roomId) {
      const outcome = await assignTenantToBed(req.propertyId!, tenantId, {
        bedId,
        roomId,
      });

      return res.json({
        ...updated,
        bedId: outcome.bedId,
        roomId: outcome.roomId,
        bedNumber: outcome.bedNumber,
        roomNumber: outcome.roomNumber,
      });
    }

    const [fresh] = await db
      .select()
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    res.json(fresh);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// Delete tenant
router.delete("/:tenantId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const tenantId = param(req, "tenantId");

    const [existing] = await db
      .select({ id: tenant.id, bedId: tenant.bedId })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // tenant.bedId is RESTRICT, so the bed must be released first; doing it
    // here keeps bed status correct instead of leaving a phantom occupant.
    await db.transaction(async (tx) => {
      if (existing.bedId) {
        await tx
          .update(tenant)
          .set({ bedId: null, roomId: null })
          .where(eq(tenant.id, tenantId));
        await tx
          .update(bed)
          .set({ status: "vacant", updatedAt: new Date() })
          .where(eq(bed.id, existing.bedId));
      }

      await tx.delete(tenant).where(eq(tenant.id, tenantId));
    });

    res.json({ message: "Tenant deleted" });
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

export default router;
