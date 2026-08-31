import { Router } from "express";
import { z } from "zod";
import { db, tenant, room, bed, bill, advancePayment, securityDeposit, payment } from "@pgkhata/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, HttpError } from "../lib/http";
import {
  assignTenantToBed,
  vacateTenantBed,
} from "../lib/tenant-assignment";
import { decideTenantApproval, generateOnboardingToken } from "../lib/tenant-approval";
import { calculateCheckoutPreview } from "../lib/checkout-preview";
import { validateTransfer } from "../lib/bed-transfer";

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
  status: z.enum(["pending", "active", "vacating", "vacated", "rejected"]).optional(),
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

// Create tenant — always starts as pending. The owner approves from the
// tenants list, which is when bed assignment actually happens. This matches
// the public signup flow and Niketan's "signup or manual entry" model.
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

    // Resolve bedId to its parent room so approval knows where to place them.
    let requestedRoomId = roomId;
    if (bedId && !roomId) {
      const [b] = await db
        .select({ roomId: bed.roomId })
        .from(bed)
        .where(eq(bed.id, bedId))
        .limit(1);
      requestedRoomId = b?.roomId;
    }

    const [newTenant] = await db
      .insert(tenant)
      .values({
        ...fields,
        propertyId: req.propertyId!,
        status: "pending",
        requestedRoomId: requestedRoomId || null,
      })
      .returning();

    if (!newTenant) {
      return res.status(500).json({ error: "Failed to create tenant" });
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

/**
 * Approve or reject a tenant who signed up through the public link.
 * Approving places them in the room they requested at signup (first vacant
 * bed there) in the same step — a pending tenant holds no bed, so there is
 * nothing to place until this succeeds. Rejecting never touches a bed.
 */
async function decideApproval(
  req: AuthenticatedRequest,
  res: import("express").Response,
  next: import("express").NextFunction,
  decision: "approve" | "reject",
) {
  try {
    const tenantId = param(req, "tenantId");

    const [target] = await db
      .select()
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Tenant not found" });

    const result = decideTenantApproval(target, decision);
    if (!result.ok) {
      return res.status(409).json({ error: "This tenant has already been decided" });
    }

    if (decision === "reject") {
      const [updated] = await db
        .update(tenant)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(tenant.id, tenantId))
        .returning();
      return res.json(updated);
    }

    // Approve: assign the requested room's first vacant bed, then activate.
    // If no room was requested (a manually-added tenant somehow left
    // pending), activate without placing them — the owner assigns a bed
    // separately via assign-bed.
    if (target.requestedRoomId) {
      await assignTenantToBed(req.propertyId!, tenantId, { roomId: target.requestedRoomId });
    }

    const [updated] = await db
      .update(tenant)
      .set({
        status: "active",
        onboardingToken: generateOnboardingToken(),
        updatedAt: new Date(),
      })
      .where(eq(tenant.id, tenantId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: `Failed to ${decision} tenant` });
  }
}

router.post("/:tenantId/approve", (req: AuthenticatedRequest, res, next) =>
  decideApproval(req, res, next, "approve"),
);
router.post("/:tenantId/reject", (req: AuthenticatedRequest, res, next) =>
  decideApproval(req, res, next, "reject"),
);

/** (Re)issue the private onboarding link for an already-approved tenant. */
router.post("/:tenantId/onboarding-link", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");

    const [target] = await db
      .select({ id: tenant.id, status: tenant.status })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Tenant not found" });
    if (target.status !== "active") {
      return res.status(409).json({ error: "Only an approved tenant can have an onboarding link" });
    }

    const onboardingToken = generateOnboardingToken();
    await db
      .update(tenant)
      .set({ onboardingToken, updatedAt: new Date() })
      .where(eq(tenant.id, tenantId));

    res.json({ onboardingToken });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate onboarding link" });
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

// Checkout financial preview
router.get("/:tenantId/checkout-preview", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");

    const [t] = await db
      .select()
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    const bills = await db
      .select({ totalAmount: bill.totalAmount, paidAmount: bill.paidAmount, balance: bill.balance })
      .from(bill)
      .where(eq(bill.tenantId, tenantId));

    const [deposit] = await db
      .select()
      .from(securityDeposit)
      .where(eq(securityDeposit.tenantId, tenantId))
      .limit(1);

    const advances = await db
      .select()
      .from(advancePayment)
      .where(eq(advancePayment.tenantId, tenantId));

    const preview = calculateCheckoutPreview({
      outstandingBills: bills,
      securityDeposit: deposit ?? null,
      advancePayments: advances,
    });

    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate checkout preview" });
  }
});

// Bed transfer — atomically moves tenant from current bed to new bed
router.post("/:tenantId/transfer", async (req: AuthenticatedRequest, res, next) => {
  try {
    const tenantId = param(req, "tenantId");
    const { bedId } = z.object({ bedId: z.string().uuid() }).parse(req.body);

    const [t] = await db
      .select()
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    // Verify new bed belongs to property
    const [newBed] = await db
      .select({ id: bed.id, status: bed.status, roomId: bed.roomId })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(and(eq(bed.id, bedId), eq(room.propertyId, req.propertyId!)))
      .limit(1);

    if (!newBed) return res.status(404).json({ error: "Bed not found" });

    const validation = validateTransfer(t.bedId, bedId, newBed.status);
    if (!validation.ok) {
      return res.status(409).json({ error: validation.reason });
    }

    // Use existing assignTenantToBed which handles freeing old bed
    const outcome = await assignTenantToBed(req.propertyId!, tenantId, { bedId });

    res.json({ message: `Transferred to bed ${outcome.roomNumber}-${outcome.bedNumber}`, ...outcome });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to transfer bed" });
  }
});

// Tenant financial report
router.get("/:tenantId/financial-report", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");

    const [t] = await db
      .select()
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    const bills = await db
      .select()
      .from(bill)
      .where(eq(bill.tenantId, tenantId))
      .orderBy(asc(bill.billMonth));

    const payments = await db
      .select()
      .from(payment)
      .innerJoin(bill, eq(payment.billId, bill.id))
      .where(eq(bill.tenantId, tenantId));

    const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPaid = bills.reduce((sum, b) => sum + b.paidAmount, 0);
    const totalBalance = bills.reduce((sum, b) => sum + b.balance, 0);

    res.json({
      tenant: { id: t.id, name: t.name, phone: t.phone, status: t.status },
      summary: { totalBilled, totalPaid, totalBalance },
      bills,
      payments: payments.map((p) => p.payment),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate financial report" });
  }
});

export default router;
