import { Router } from "express";
import { z } from "zod";
import { db, bed, room, floor } from "@pgkhata/db";
import { eq, and, asc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { BED_STATUSES } from "../lib/beds";

const router = Router({ mergeParams: true });

const statusSchema = z.object({
  status: z.enum(BED_STATUSES),
});

const updateBedSchema = z.object({
  monthlyRent: z.number().int().min(0).nullable().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

/**
 * Every bed query joins through room to the verified property, so a bed id
 * belonging to another owner resolves to nothing rather than leaking a row.
 */
function bedInProperty(propertyId: string, bedId: string) {
  return db
    .select({ bed: bed, roomNumber: room.number })
    .from(bed)
    .innerJoin(room, eq(bed.roomId, room.id))
    .where(and(eq(bed.id, bedId), eq(room.propertyId, propertyId)))
    .limit(1);
}

/** All beds in the property, with their room and floor for display. */
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const beds = await db
      .select({
        bed: bed,
        roomId: room.id,
        roomNumber: room.number,
        floorName: floor.name,
      })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .leftJoin(floor, eq(room.floorId, floor.id))
      .where(eq(room.propertyId, req.propertyId!))
      .orderBy(asc(floor.position), asc(room.number), asc(bed.number));

    res.json(beds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch beds" });
  }
});

/** Beds available for assignment. Maintenance beds are deliberately excluded. */
router.get("/vacant", async (req: AuthenticatedRequest, res) => {
  try {
    const beds = await db
      .select({
        bed: bed,
        roomId: room.id,
        roomNumber: room.number,
        roomRent: room.monthlyRent,
        floorName: floor.name,
      })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .leftJoin(floor, eq(room.floorId, floor.id))
      .where(and(eq(room.propertyId, req.propertyId!), eq(bed.status, "vacant")))
      .orderBy(asc(floor.position), asc(room.number), asc(bed.number));

    res.json(beds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vacant beds" });
  }
});

router.get("/:bedId", async (req: AuthenticatedRequest, res) => {
  try {
    const [found] = await bedInProperty(req.propertyId!, param(req, "bedId"));
    if (!found) return res.status(404).json({ error: "Bed not found" });

    res.json({ ...found.bed, roomNumber: found.roomNumber });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bed" });
  }
});

/**
 * Status is its own endpoint because it is the one field with a workflow:
 * putting a bed under maintenance takes it out of the vacant pool, and a bed
 * held by a tenant may not be taken out of use.
 */
router.patch("/:bedId/status", async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const bedId = param(req, "bedId");

    const [found] = await bedInProperty(req.propertyId!, bedId);
    if (!found) return res.status(404).json({ error: "Bed not found" });

    if (found.bed.status === "occupied" && status === "maintenance") {
      return res.status(409).json({
        error: `Bed ${found.roomNumber}-${found.bed.number} is occupied. Vacate it before marking maintenance.`,
      });
    }

    const [updated] = await db
      .update(bed)
      .set({ status, updatedAt: new Date() })
      .where(eq(bed.id, bedId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update bed status" });
  }
});

/** Per-bed rent override; null clears it and falls back to the room's rent. */
router.put("/:bedId", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updateBedSchema.parse(req.body);
    const bedId = param(req, "bedId");

    const [found] = await bedInProperty(req.propertyId!, bedId);
    if (!found) return res.status(404).json({ error: "Bed not found" });

    const [updated] = await db
      .update(bed)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(bed.id, bedId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update bed" });
  }
});

export default router;
