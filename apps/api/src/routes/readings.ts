import { Router } from "express";
import { z } from "zod";
import { db, electricityReading, room } from "@pgkhata/db";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";

const router = Router({ mergeParams: true });

const createReadingSchema = z.object({
  roomId: z.string().uuid(),
  reading: z.number().min(0),
  readingDate: z.string().transform((str) => new Date(str)),
});

const listReadingsSchema = z.object({
  roomId: z.string().uuid().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

/** Proves a room belongs to the already-verified property. */
async function ownedRoom(propertyId: string, roomId: string) {
  const [r] = await db
    .select()
    .from(room)
    .where(and(eq(room.id, roomId), eq(room.propertyId, propertyId)))
    .limit(1);
  return r;
}

// Get readings for the property, optionally narrowed to one room
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId } = listReadingsSchema.parse(req.query);

    // Scope by room ownership, not by a client-supplied roomId alone: filtering
    // on the raw query value would return another owner's readings.
    if (roomId) {
      if (!(await ownedRoom(req.propertyId!, roomId))) {
        return res.status(404).json({ error: "Room not found" });
      }

      const readings = await db
        .select()
        .from(electricityReading)
        .where(eq(electricityReading.roomId, roomId))
        .orderBy(desc(electricityReading.readingDate));

      return res.json(readings);
    }

    const readings = await db
      .select({
        reading: electricityReading,
        roomNumber: room.number,
      })
      .from(electricityReading)
      .innerJoin(room, eq(electricityReading.roomId, room.id))
      .where(eq(room.propertyId, req.propertyId!))
      .orderBy(desc(electricityReading.readingDate));

    res.json(readings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});

// Create reading
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createReadingSchema.parse(req.body);

    const r = await ownedRoom(req.propertyId!, body.roomId);
    if (!r) return res.status(404).json({ error: "Room not found" });

    // Get last reading for monotonic check
    const [lastReading] = await db
      .select()
      .from(electricityReading)
      .where(eq(electricityReading.roomId, body.roomId))
      .orderBy(desc(electricityReading.readingDate))
      .limit(1);

    if (lastReading && body.reading < lastReading.reading) {
      return res.status(400).json({ error: "Reading cannot be less than previous reading" });
    }

    const units = lastReading ? body.reading - lastReading.reading : 0;

    const [newReading] = await db
      .insert(electricityReading)
      .values({
        roomId: body.roomId,
        reading: body.reading,
        readingDate: body.readingDate,
        units,
      })
      .returning();

    res.status(201).json(newReading);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create reading" });
  }
});

export default router;
