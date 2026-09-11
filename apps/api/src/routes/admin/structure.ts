import { Router } from "express";
import { db, property, floor, room, bed } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { param } from "../../lib/http";

/**
 * `PATCH /beds/:bedId` used to live here and was removed.
 *
 * It wrote `bed.status` directly, with no check that the bed was free and no
 * corresponding tenant move, which is precisely how bed occupancy drifts away
 * from the tenants holding the beds. Flipping a status is not a repair; the
 * repair is `POST /properties/:propertyId/reconcile-beds`, which derives status
 * from the tenant rows instead of overwriting it. Real moves go through the
 * owner assignment route via impersonation.
 */

const router = Router();

router.get("/properties/:propertyId/structure", async (req: AuthenticatedRequest, res) => {
  const propertyId = param(req, "propertyId");

  const [prop] = await db
    .select({ id: property.id, name: property.name })
    .from(property)
    .where(eq(property.id, propertyId))
    .limit(1);

  if (!prop) return res.status(404).json({ error: "Property not found" });

  const [floors, rooms, beds] = await Promise.all([
    db.select().from(floor).where(eq(floor.propertyId, propertyId)).orderBy(floor.position),
    db.select().from(room).where(eq(room.propertyId, propertyId)),
    db
      // Flat, matching /properties/:id/details — the nested `{ bed, roomNumber }`
      // shape silently rendered empty bed trees and zeroed stat counters in the
      // admin UI, because every consumer read the flat fields.
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
  ]);

  res.json({ propertyId: prop.id, propertyName: prop.name, floors, rooms, beds });
});

router.get("/properties/:propertyId/floors", async (req: AuthenticatedRequest, res) => {
  const propertyId = param(req, "propertyId");
  const floors = await db
    .select()
    .from(floor)
    .where(eq(floor.propertyId, propertyId))
    .orderBy(floor.position);
  res.json(floors);
});

router.get("/properties/:propertyId/rooms", async (req: AuthenticatedRequest, res) => {
  const propertyId = param(req, "propertyId");
  const rooms = await db.select().from(room).where(eq(room.propertyId, propertyId));
  res.json(rooms);
});

router.get("/properties/:propertyId/beds", async (req: AuthenticatedRequest, res) => {
  const propertyId = param(req, "propertyId");
  const beds = await db
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
    .where(eq(room.propertyId, propertyId));
  res.json(beds);
});

export default router;
