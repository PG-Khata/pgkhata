import { Router } from "express";
import { z } from "zod";
import { db, room, floor, bed, rentPlan } from "@pgkhata/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { bedLabelsForCapacity, reconcileBeds } from "../lib/beds";

const router = Router({ mergeParams: true });

const createRoomSchema = z.object({
  number: z.string().min(1).max(20),
  type: z.enum(["single", "double", "triple", "dormitory"]).default("single"),
  capacity: z.number().min(1).max(20).default(1),
  monthlyRent: z.number().min(0),
  floorId: z.string().uuid().nullable().optional(),
  rentPlanId: z.string().uuid().nullable().optional(),
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

/** Same shape of check for the rent plan a room is priced under. */
async function assertPlanInProperty(
  propertyId: string,
  planId: string | null | undefined,
): Promise<boolean> {
  if (!planId) return true;

  const [p] = await db
    .select({ id: rentPlan.id })
    .from(rentPlan)
    .where(and(eq(rentPlan.id, planId), eq(rentPlan.propertyId, propertyId)))
    .limit(1);

  return Boolean(p);
}

// Get all rooms for property, grouped-ready with floor details and beds
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const rooms = await db
      .select({
        room: room,
        floorName: floor.name,
        floorPosition: floor.position,
        planName: rentPlan.name,
        planRent: rentPlan.monthlyRent,
      })
      .from(room)
      .leftJoin(floor, eq(room.floorId, floor.id))
      .leftJoin(rentPlan, eq(room.rentPlanId, rentPlan.id))
      .where(eq(room.propertyId, req.propertyId!))
      .orderBy(asc(floor.position), asc(room.number));

    const roomIds = rooms.map((row) => row.room.id);
    const beds =
      roomIds.length > 0
        ? await db
            .select()
            .from(bed)
            .where(inArray(bed.roomId, roomIds))
            .orderBy(asc(bed.number))
        : [];

    const bedsByRoom = new Map<string, typeof beds>();
    for (const b of beds) {
      const bucket = bedsByRoom.get(b.roomId);
      if (bucket) bucket.push(b);
      else bedsByRoom.set(b.roomId, [b]);
    }

    res.json(
      rooms.map((row) => ({
        ...row.room,
        floorName: row.floorName,
        floorPosition: row.floorPosition,
        planName: row.planName,
        planRent: row.planRent,
        beds: bedsByRoom.get(row.room.id) ?? [],
      })),
    );
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

    if (!(await assertPlanInProperty(req.propertyId!, body.rentPlanId))) {
      return res.status(404).json({ error: "Rent plan not found" });
    }

    // One transaction so a room can never exist without its beds — occupancy
    // is measured in beds, and a bedless room would read as 0 capacity.
    const newRoom = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(room)
        .values({
          ...body,
          propertyId: req.propertyId!,
        })
        .onConflictDoNothing({ target: [room.propertyId, room.number] })
        .returning();

      if (!created) return undefined;

      await tx.insert(bed).values(
        bedLabelsForCapacity(created.capacity).map((label) => ({
          roomId: created.id,
          number: label,
        })),
      );

      return created;
    });

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
    const roomId = param(req, "roomId");

    if (!(await assertFloorInProperty(req.propertyId!, body.floorId))) {
      return res.status(404).json({ error: "Floor not found" });
    }

    if (!(await assertPlanInProperty(req.propertyId!, body.rentPlanId))) {
      return res.status(404).json({ error: "Rent plan not found" });
    }

    const [existingRoom] = await db
      .select()
      .from(room)
      .where(and(eq(room.id, roomId), eq(room.propertyId, req.propertyId!)))
      .limit(1);

    if (!existingRoom) {
      return res.status(404).json({ error: "Room not found" });
    }

    // A capacity change adds or removes beds. Refuse before writing anything if
    // the shrink would delete a bed someone is sleeping in.
    if (body.capacity !== undefined && body.capacity !== existingRoom.capacity) {
      const existingBeds = await db
        .select({ number: bed.number, status: bed.status })
        .from(bed)
        .where(eq(bed.roomId, roomId));

      const plan = reconcileBeds(existingBeds, body.capacity);

      if (plan.blockedBy.length > 0) {
        return res.status(409).json({
          error: `Cannot reduce capacity: bed ${plan.blockedBy.join(", ")} ${
            plan.blockedBy.length === 1 ? "is" : "are"
          } occupied. Vacate first.`,
        });
      }

      const updated = await db.transaction(async (tx) => {
        if (plan.toCreate.length > 0) {
          await tx
            .insert(bed)
            .values(plan.toCreate.map((label) => ({ roomId, number: label })));
        }

        if (plan.toDelete.length > 0) {
          await tx
            .delete(bed)
            .where(and(eq(bed.roomId, roomId), inArray(bed.number, plan.toDelete)));
        }

        const [row] = await tx
          .update(room)
          .set({ ...body, updatedAt: new Date() })
          .where(and(eq(room.id, roomId), eq(room.propertyId, req.propertyId!)))
          .returning();

        return row;
      });

      return res.json(updated);
    }

    const [updated] = await db
      .update(room)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(room.id, roomId), eq(room.propertyId, req.propertyId!)))
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
    const roomId = param(req, "roomId");

    const [target] = await db
      .select({ id: room.id })
      .from(room)
      .where(and(eq(room.id, roomId), eq(room.propertyId, req.propertyId!)))
      .limit(1);

    if (!target) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Beds cascade with the room, so refuse while anyone still holds one.
    const occupied = await db
      .select({ number: bed.number })
      .from(bed)
      .where(and(eq(bed.roomId, roomId), eq(bed.status, "occupied")))
      .orderBy(asc(bed.number));

    if (occupied.length > 0) {
      return res.status(409).json({
        error: `Room still has ${occupied.length} occupied bed${
          occupied.length === 1 ? "" : "s"
        } (${occupied.map((b) => b.number).join(", ")}). Vacate first.`,
      });
    }

    await db.delete(room).where(eq(room.id, roomId));

    res.json({ message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete room" });
  }
});

export default router;
