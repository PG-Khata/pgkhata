import { Router } from "express";
import { z } from "zod";
import { db, floor, room } from "@pgkhata/db";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param, aggregate } from "../lib/http";

const router = Router({ mergeParams: true });

const createFloorSchema = z.object({
  name: z.string().min(1).max(50),
  position: z.number().int().min(0).max(200).optional(),
});

const updateFloorSchema = createFloorSchema.partial();

const reorderSchema = z.object({
  floorIds: z.array(z.string().uuid()).min(1),
});

router.use(requireAuth, requireOwner, requireProperty);

/** Floors ordered for display, each with the number of rooms on it. */
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const floors = await db
      .select({
        floor: floor,
        roomCount: sql<number>`count(${room.id})::int`,
      })
      .from(floor)
      .leftJoin(room, eq(room.floorId, floor.id))
      .where(eq(floor.propertyId, req.propertyId!))
      .groupBy(floor.id)
      .orderBy(asc(floor.position), asc(floor.name));

    res.json(floors);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch floors" });
  }
});

router.get("/:floorId", async (req: AuthenticatedRequest, res) => {
  try {
    const [f] = await db
      .select()
      .from(floor)
      .where(
        and(
          eq(floor.id, param(req, "floorId")),
          eq(floor.propertyId, req.propertyId!),
        ),
      )
      .limit(1);

    if (!f) return res.status(404).json({ error: "Floor not found" });

    res.json(f);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch floor" });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createFloorSchema.parse(req.body);

    // Default to the end of the list rather than colliding on position 0.
    let position = body.position;
    if (position === undefined) {
      const { maxPosition } = aggregate(
        await db
          .select({
            maxPosition: sql<number>`coalesce(max(${floor.position}), -1)::int`,
          })
          .from(floor)
          .where(eq(floor.propertyId, req.propertyId!)),
        { maxPosition: -1 },
      );
      position = maxPosition + 1;
    }

    const [created] = await db
      .insert(floor)
      .values({ propertyId: req.propertyId!, name: body.name, position })
      .onConflictDoNothing({ target: [floor.propertyId, floor.name] })
      .returning();

    if (!created) {
      return res.status(409).json({ error: "Floor name already exists" });
    }

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create floor" });
  }
});

/**
 * Reassigns positions from the supplied order. Runs in one transaction so a
 * partial failure cannot leave the property with duplicate or missing
 * positions, and rejects any id that is not a floor of this property.
 */
router.post("/reorder", async (req: AuthenticatedRequest, res) => {
  try {
    const { floorIds } = reorderSchema.parse(req.body);

    if (new Set(floorIds).size !== floorIds.length) {
      return res.status(400).json({ error: "Duplicate floor ids" });
    }

    const owned = await db
      .select({ id: floor.id })
      .from(floor)
      .where(
        and(eq(floor.propertyId, req.propertyId!), inArray(floor.id, floorIds)),
      );

    if (owned.length !== floorIds.length) {
      return res.status(404).json({ error: "Floor not found" });
    }

    const reordered = await db.transaction(async (tx) => {
      for (const [index, id] of floorIds.entries()) {
        await tx
          .update(floor)
          .set({ position: index, updatedAt: new Date() })
          .where(and(eq(floor.id, id), eq(floor.propertyId, req.propertyId!)));
      }

      return tx
        .select()
        .from(floor)
        .where(eq(floor.propertyId, req.propertyId!))
        .orderBy(asc(floor.position), asc(floor.name));
    });

    res.json(reordered);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to reorder floors" });
  }
});

router.put("/:floorId", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updateFloorSchema.parse(req.body);

    const [updated] = await db
      .update(floor)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(floor.id, param(req, "floorId")),
          eq(floor.propertyId, req.propertyId!),
        ),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Floor not found" });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update floor" });
  }
});

router.delete("/:floorId", async (req: AuthenticatedRequest, res) => {
  try {
    const floorId = param(req, "floorId");

    const [f] = await db
      .select({ id: floor.id })
      .from(floor)
      .where(and(eq(floor.id, floorId), eq(floor.propertyId, req.propertyId!)))
      .limit(1);

    if (!f) return res.status(404).json({ error: "Floor not found" });

    // Answer 409 rather than letting the RESTRICT surface as a 500. The
    // constraint is still the backstop for a concurrent room create.
    const { roomCount } = aggregate(
      await db
        .select({ roomCount: sql<number>`count(*)::int` })
        .from(room)
        .where(eq(room.floorId, floorId)),
      { roomCount: 0 },
    );

    if (roomCount > 0) {
      return res.status(409).json({
        error: `Floor still has ${roomCount} room${roomCount === 1 ? "" : "s"}. Move or delete them first.`,
      });
    }

    await db.delete(floor).where(eq(floor.id, floorId));

    res.json({ message: "Floor deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete floor" });
  }
});

export default router;
