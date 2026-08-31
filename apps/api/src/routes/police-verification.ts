import { Router } from "express";
import { z } from "zod";
import { db, tenant, property, room, floor } from "@pgkhata/db";
import { eq, and, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner, requireProperty);

// Get police verification status for all tenants in a property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = req.propertyId!;

    const rows = await db
      .select({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantEmail: tenant.email,
        aadhaarNumber: tenant.aadhaarNumber,
        panNumber: tenant.panNumber,
        roomId: tenant.roomId,
        roomNumber: room.number,
        floorName: floor.name,
        joiningDate: tenant.joiningDate,
        policeVerificationStatus: tenant.policeVerificationStatus,
        policeVerificationDate: tenant.policeVerificationDate,
        policeVerificationNotes: tenant.policeVerificationNotes,
      })
      .from(tenant)
      .leftJoin(room, eq(tenant.roomId, room.id))
      .leftJoin(floor, eq(room.floorId, floor.id))
      .where(and(eq(tenant.propertyId, propertyId), sql`${tenant.status} != 'deleted'`))
      .orderBy(tenant.name);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch police verification status" });
  }
});

// Update police verification status for a tenant
router.patch("/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const { status, notes } = req.body;

    const validStatuses = ["pending", "submitted", "verified", "rejected", "not_required"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const [updated] = await db
      .update(tenant)
      .set({
        policeVerificationStatus: status,
        policeVerificationDate: status === "submitted" ? new Date() : undefined,
        policeVerificationNotes: notes,
      })
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update police verification status" });
  }
});

// Generate police verification form data for a tenant
router.get("/:tenantId/form", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");

    const [row] = await db
      .select({
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantEmail: tenant.email,
        aadhaarNumber: tenant.aadhaarNumber,
        panNumber: tenant.panNumber,
        permanentAddress: tenant.permanentAddress,
        joiningDate: tenant.joiningDate,
        propertyName: property.name,
        propertyAddress: property.address,
        roomNumber: room.number,
        floorName: floor.name,
      })
      .from(tenant)
      .innerJoin(property, eq(tenant.propertyId, property.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .leftJoin(floor, eq(room.floorId, floor.id))
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Generate form data in standard police verification format
    const formData = {
      // Property details
      propertyName: row.propertyName,
      propertyAddress: row.propertyAddress,
      
      // Tenant details
      tenantName: row.tenantName,
      tenantPhone: row.tenantPhone,
      tenantEmail: row.tenantEmail,
      aadhaarNumber: row.aadhaarNumber,
      panNumber: row.panNumber,
      permanentAddress: row.permanentAddress,
      
      // Stay details
      roomNumber: row.roomNumber,
      floorName: row.floorName,
      joiningDate: row.joiningDate,
      
      // Form metadata
      generatedAt: new Date().toISOString(),
      formType: "police_verification",
    };

    res.json(formData);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate police verification form" });
  }
});

// Get verification statistics for a property
router.get("/stats", async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = req.propertyId!;

    const stats = await db
      .select({
        status: tenant.policeVerificationStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(tenant)
      .where(and(eq(tenant.propertyId, propertyId), sql`${tenant.status} != 'deleted'`))
      .groupBy(tenant.policeVerificationStatus);

    const result = {
      total: 0,
      pending: 0,
      submitted: 0,
      verified: 0,
      rejected: 0,
      not_required: 0,
    };

    for (const row of stats) {
      const status = row.status || "pending";
      result[status as keyof typeof result] = row.count;
      result.total += row.count;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch verification statistics" });
  }
});

export default router;
