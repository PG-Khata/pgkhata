import { Router } from "express";
import { z } from "zod";
import { db, room, floor } from "@pgkhata/db";
import { eq, and, asc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

const createRoomSchema = z.object({
  number: z.string().min(1).max(20),
  type: z.enum(["single", "double", "triple", "dormitory"]).default("single"),
  capacity: z.number().min(1).max(20).default(1),
  monthlyRent: z.number().min(0),
  floorId: z.string().uuid().nullable().optional(),
});

const updateRoomSchema = createRoomSchema.partial();

router.use(requireAuth, requireOwner, requireProperty);

/** A floor id is only acceptable if it belongs to the same property. */
async function assertFloorInProperty(
  propertyId: string,
  floorId: string | null | undefined,
): Promise<boolean> {
  if (!floorId) return true;

  const [f] = await db
    .select({ id: floor.id })
    .from(floor)
    .where(and(eq(floor.id, floorId), eq(floor.propertyId, propertyId)))
    .limit(1);

  return Boolean(f);
}

// Get all rooms for property, grouped-ready with floor details
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const rooms = await db
      .select({
        room: room,
        floorName: floor.name,
        floorPosition: floor.position,
      })
      .from(room)
      .leftJoin(floor, eq(room.floorId, floor.id))
      .where(eq(room.propertyId, req.propertyId!))
      .orderBy(asc(floor.position), asc(room.number));

    res.json(rooms.map((row) => ({ ...row.room, floorName: row.floorName, floorPosition: row.floorPosition })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Get single room
router.get("/:roomId", async (req: AuthenticatedRequest, res) => {
  try {
    const [r] = await db
      .select()
      .from(room)
      .where(
        and(
          eq(room.id, param(req, "roomId")),
          eq(room.propertyId, req.propertyId!)
        )
      )
      .limit(1);

    if (!r) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(r);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// Create room
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createRoomSchema.parse(req.body);

    if (!(await assertFloorInProperty(req.propertyId!, body.floorId))) {
      return res.status(404).json({ error: "Floor not found" });
    }

    const [newRoom] = await db
      .insert(room)
      .values({
        ...body,
        propertyId: req.propertyId!,
      })
      .onConflictDoNothing({ target: [room.propertyId, room.number] })
      .returning();

    if (!newRoom) {
      return res.status(409).json({ error: "Room number already exists" });
    }

    res.status(201).json(newRoom);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Update room
router.put("/:roomId", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updateRoomSchema.parse(req.body);

    if (!(await assertFloorInProperty(req.propertyId!, body.floorId))) {
      return res.status(404).json({ error: "Floor not found" });
    }

    const [updated] = await db
      .update(room)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(room.id, param(req, "roomId")),
          eq(room.propertyId, req.propertyId!)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update room" });
  }
});

// Delete room
router.delete("/:roomId", async (req: AuthenticatedRequest, res) => {
  try {
    const [deleted] = await db
      .delete(room)
      .where(
        and(
          eq(room.id, param(req, "roomId")),
          eq(room.propertyId, req.propertyId!)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({ message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete room" });
  }
});

export default router;
