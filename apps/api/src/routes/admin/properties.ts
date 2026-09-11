import { Router } from "express";
import { z } from "zod";
import { db, user, ownerProfile, property, tenant, floor, room, bed } from "@pgkhata/db";
import { eq, sql, desc, and, exists, not } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { aggregate, param } from "../../lib/http";
import { reconcileBedStatuses } from "../../lib/tenant-assignment";
import { reconcileOverdueStatuses } from "../../lib/bill-status";
import { pagination, sendPageWithTotal } from "../../lib/pagination";
import {
  booleanParam,
  contains,
  countAll,
  every,
  idParam,
  parseFilters,
  searchAcross,
  searchParam,
} from "../../lib/admin-list";

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

/**
 * Occupancy for one property, as correlated scalar subqueries.
 *
 * The list endpoint could not afford these while it was unbounded — one pair of
 * subqueries per property across the whole platform — which is why it returned
 * no counts at all and the admin table rendered a hardcoded-looking `0/0`.
 * Bounded to a page they are at most `pageSize` index lookups.
 */
const totalBedsExpr = sql<number>`(
  select count(*)::int from ${bed}
  join ${room} on ${bed.roomId} = ${room.id}
  where ${room.propertyId} = ${property.id}
)`;

const occupiedBedsExpr = sql<number>`(
  select count(*)::int from ${bed}
  join ${room} on ${bed.roomId} = ${room.id}
  where ${room.propertyId} = ${property.id} and ${bed.status} = 'occupied'
)`;

const activeTenantsExpr = sql<number>`(
  select count(*)::int from ${tenant}
  where ${tenant.propertyId} = ${property.id} and ${tenant.status} = 'active'
)`;

const propertyFilterSchema = z.object({
  q: searchParam.optional(),
  ownerId: idParam.optional(),
  city: z.string().trim().min(1).max(100).optional(),
  // "meter", not "metered": these are the literals the owner-side property
  // route writes (`src/routes/properties.ts`) and `src/routes/billing.ts`
  // compares against. A filter that accepted a different spelling would 400 on
  // the value the column actually holds.
  electricityMode: z.enum(["flat", "meter"]).optional(),
  hasTenants: booleanParam.optional(),
});

/**
 * Platform-wide property list, one page at a time, with occupancy per row.
 *
 * `hasTenants` is defined as "has at least one *active* tenant", deliberately
 * the same predicate as the `activeTenants` column this row returns, so
 * `hasTenants=false` and `activeTenants === 0` can never disagree in the UI.
 * Pending signups therefore do not count as tenants — which is the reading
 * support wants, since the question behind the filter is "is this property
 * actually live".
 */
router.get("/properties", async (req, res) => {
  const filters = parseFilters(req, res, propertyFilterSchema);
  if (!filters) return;
  const page = pagination(req);

  const occupied = exists(
    db
      .select({ one: sql`1` })
      .from(tenant)
      .where(and(eq(tenant.propertyId, property.id), eq(tenant.status, "active"))),
  );

  const where = every(
    filters.q ? searchAcross(filters.q, [property.name, property.code, property.city]) : undefined,
    filters.ownerId ? eq(property.ownerId, filters.ownerId) : undefined,
    // Substring, not equality: `city` is free text an owner typed, so exact
    // matching would miss "Bengaluru " and "bengaluru" in the same breath.
    filters.city ? contains(property.city, filters.city) : undefined,
    filters.electricityMode ? eq(property.electricityMode, filters.electricityMode) : undefined,
    filters.hasTenants === undefined ? undefined : filters.hasTenants ? occupied : not(occupied),
  );

  const [properties, totalRows] = await Promise.all([
    db
      .select({
        ...propertyColumns,
        totalBeds: totalBedsExpr,
        occupiedBeds: occupiedBedsExpr,
        activeTenants: activeTenantsExpr,
      })
      .from(property)
      .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(where)
      .orderBy(desc(property.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    // No owner join: nothing filterable lives on `user`, and the occupancy
    // subqueries are per-returned-row so the count must not carry them.
    db.select({ total: countAll }).from(property).where(where),
  ]);

  sendPageWithTotal(res, properties, page, aggregate(totalRows, { total: 0 }).total);
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
