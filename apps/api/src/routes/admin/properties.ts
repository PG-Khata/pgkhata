import { Router } from "express";
import { db, user, ownerProfile, property, tenant, floor, room, bed } from "@pgkhata/db";
import { eq, sql, desc, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { aggregate, param } from "../../lib/http";
import { reconcileBedStatuses } from "../../lib/tenant-assignment";
import { reconcileOverdueStatuses } from "../../lib/bill-status";

/**
 * `PUT /properties/:propertyId` and `DELETE /properties/:propertyId` used to
 * live here and were removed.
 *
 * The PUT set `electricityMode` and `electricityRatePerUnit` straight onto the
 * row, skipping the owner route's validation, so a property could be switched
 * to metered billing with no rate and the next billing run would price
 * electricity at zero. The DELETE hit a foreign key and answered 500. Support
 * reaches the correct owner-side versions through impersonation.
 *
 * What remains are repairs: they re-derive state that is already implied by
 * other rows, so they cannot invent a number, and running one twice is a no-op.
 */

const router = Router();

const propertyColumns = {
  id: property.id,
  ownerId: property.ownerId,
  name: property.name,
  code: property.code,
  address: property.address,
  city: property.city,
  state: property.state,
  pincode: property.pincode,
  electricityMode: property.electricityMode,
  createdAt: property.createdAt,
  updatedAt: property.updatedAt,
  ownerName: user.name,
};

router.get("/properties", async (_req, res) => {
  const properties = await db
    .select(propertyColumns)
    .from(property)
    .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .orderBy(desc(property.createdAt));

  res.json(properties);
});

router.get("/properties/:propertyId", async (req: AuthenticatedRequest, res) => {
  const propertyId = param(req, "propertyId");

  const [prop] = await db
    .select(propertyColumns)
    .from(property)
    .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .where(eq(property.id, propertyId))
    .limit(1);

  if (!prop) return res.status(404).json({ error: "Property not found" });

  const [totalBedRows, occupiedBedRows, activeTenantRows] = await Promise.all([
    db
      .select({ totalBeds: sql<number>`count(*)::int` })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(eq(room.propertyId, propertyId)),
    db
      .select({ occupiedBeds: sql<number>`count(*)::int` })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(and(eq(room.propertyId, propertyId), eq(bed.status, "occupied"))),
    db
      .select({ activeTenants: sql<number>`count(*)::int` })
      .from(tenant)
      .where(and(eq(tenant.propertyId, propertyId), eq(tenant.status, "active"))),
  ]);

  const { totalBeds } = aggregate(totalBedRows, { totalBeds: 0 });
  const { occupiedBeds } = aggregate(occupiedBedRows, { occupiedBeds: 0 });
  const { activeTenants } = aggregate(activeTenantRows, { activeTenants: 0 });

  res.json({ ...prop, totalBeds, occupiedBeds, activeTenants });
});

/** Property detail with its structure and current occupants. */
router.get("/properties/:propertyId/details", async (req: AuthenticatedRequest, res) => {
  const propertyId = param(req, "propertyId");

  const [prop] = await db
    .select({
      id: property.id,
      name: property.name,
      address: property.address,
      city: property.city,
      ownerName: user.name,
    })
    .from(property)
    .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .where(eq(property.id, propertyId))
    .limit(1);

  if (!prop) return res.status(404).json({ error: "Property not found" });

  const [floors, rooms, beds, tenants] = await Promise.all([
    db.select().from(floor).where(eq(floor.propertyId, propertyId)).orderBy(floor.position),
    db.select().from(room).where(eq(room.propertyId, propertyId)),
    // Flattened deliberately: a bare innerJoin yields drizzle's nested
    // `{ bed, room }`, which every consumer then has to destructure. Returning
    // the shape the UI actually renders keeps the join an implementation detail.
    db
      .select({
        id: bed.id,
        roomId: bed.roomId,
        number: bed.number,
        status: bed.status,
        monthlyRent: bed.monthlyRent,
        roomNumber: room.number,
        floorId: room.floorId,
      })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(eq(room.propertyId, propertyId)),
    db
      .select({
        id: tenant.id,
        name: tenant.name,
        phone: tenant.phone,
        status: tenant.status,
        roomNumber: room.number,
        bedNumber: bed.number,
      })
      .from(tenant)
      .leftJoin(room, eq(tenant.roomId, room.id))
      .leftJoin(bed, eq(tenant.bedId, bed.id))
      .where(and(eq(tenant.propertyId, propertyId), eq(tenant.status, "active"))),
  ]);

  res.json({ ...prop, floors, rooms, beds, tenants });
});

/**
 * Occupancy is reported from `bed.status`, but it is owned by the tenant rows
 * that hold the beds. When those two drift the dashboard shows a wrong
 * percentage; this recomputes the derived side from the authoritative one.
 */
router.post(
  "/properties/:propertyId/reconcile-beds",
  requireSuperAdminRole,
  async (req: AuthenticatedRequest, res) => {
    const propertyId = param(req, "propertyId");

    const [prop] = await db
      .select({ id: property.id })
      .from(property)
      .where(eq(property.id, propertyId))
      .limit(1);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    const changed = await reconcileBedStatuses(propertyId);
    res.json({ propertyId, bedsChanged: changed });
  },
);

/**
 * Overdue is a function of the due date and the balance, so it goes stale the
 * moment a due date passes with nobody reading the bill. Re-derives it for the
 * property; paid and voided bills are left alone by the helper itself.
 */
router.post(
  "/properties/:propertyId/reconcile-overdue",
  requireSuperAdminRole,
  async (req: AuthenticatedRequest, res) => {
    const propertyId = param(req, "propertyId");

    const [prop] = await db
      .select({ id: property.id })
      .from(property)
      .where(eq(property.id, propertyId))
      .limit(1);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    await reconcileOverdueStatuses([propertyId]);
    res.json({ propertyId, reconciled: true });
  },
);

export default router;
