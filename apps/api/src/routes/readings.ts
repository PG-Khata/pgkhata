import { Router } from "express";
import { z } from "zod";
import { db, electricityReading, room } from "@pgkhata/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";

const router = Router({ mergeParams: true });

const createReadingSchema = z.object({
  roomId: z.string().uuid(),
  reading: z.number().min(0),
  readingDate: z.string().transform((str) => new Date(str)),
});

const updateReadingSchema = createReadingSchema.pick({ reading: true, readingDate: true });

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

async function ownedReading(propertyId: string, readingId: string) {
  const [result] = await db
    .select({ reading: electricityReading })
    .from(electricityReading)
    .innerJoin(room, eq(electricityReading.roomId, room.id))
    .where(and(eq(electricityReading.id, readingId), eq(room.propertyId, propertyId)))
    .limit(1);
  return result?.reading;
}

function validateReadingPosition(
  reading: number,
  readingDate: Date,
  previous: typeof electricityReading.$inferSelect | undefined,
  next: typeof electricityReading.$inferSelect | undefined,
) {
  if (previous && readingDate <= previous.readingDate) {
    return "Reading date must be after the previous reading date";
  }
  if (next && readingDate >= next.readingDate) {
    return "Reading date must be before the next reading date";
  }
  if (previous && reading < previous.reading) {
    return "Reading cannot be less than the previous reading";
  }
  if (next && reading > next.reading) {
    return "Reading cannot be greater than the next reading";
  }
  return undefined;
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

    if (lastReading && body.readingDate <= lastReading.readingDate) {
      return res.status(400).json({
        error: "Reading date must be after the previous reading date",
      });
    }

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

// Edit a reading and recalculate the following reading's cached units.
router.patch("/:readingId", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updateReadingSchema.parse(req.body);
    const readingId = z.string().uuid().parse(req.params.readingId);
    const current = await ownedReading(req.propertyId!, readingId);
    if (!current) return res.status(404).json({ error: "Reading not found" });

    const readings = await db
      .select()
      .from(electricityReading)
      .where(eq(electricityReading.roomId, current.roomId))
      .orderBy(asc(electricityReading.readingDate));
    const index = readings.findIndex((reading) => reading.id === current.id);
    const previous = index > 0 ? readings[index - 1] : undefined;
    const next = index >= 0 ? readings[index + 1] : undefined;
    const validationError = validateReadingPosition(body.reading, body.readingDate, previous, next);
    if (validationError) return res.status(400).json({ error: validationError });

    const [updated] = await db.transaction(async (tx) => {
      const [updatedReading] = await tx
        .update(electricityReading)
        .set({
          reading: body.reading,
          readingDate: body.readingDate,
          units: previous ? body.reading - previous.reading : 0,
        })
        .where(eq(electricityReading.id, current.id))
        .returning();

      if (next) {
        await tx
          .update(electricityReading)
          .set({ units: next.reading - body.reading })
          .where(eq(electricityReading.id, next.id));
      }
      return [updatedReading];
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update reading" });
  }
});

// Delete a reading and join the next reading back to the preceding baseline.
router.delete("/:readingId", async (req: AuthenticatedRequest, res) => {
  try {
    const readingId = z.string().uuid().parse(req.params.readingId);
    const current = await ownedReading(req.propertyId!, readingId);
    if (!current) return res.status(404).json({ error: "Reading not found" });

    const readings = await db
      .select()
      .from(electricityReading)
      .where(eq(electricityReading.roomId, current.roomId))
      .orderBy(asc(electricityReading.readingDate));
    const index = readings.findIndex((reading) => reading.id === current.id);
    const previous = index > 0 ? readings[index - 1] : undefined;
    const next = index >= 0 ? readings[index + 1] : undefined;

    await db.transaction(async (tx) => {
      if (next) {
        await tx
          .update(electricityReading)
          .set({ units: previous ? next.reading - previous.reading : 0 })
          .where(eq(electricityReading.id, next.id));
      }
      await tx.delete(electricityReading).where(eq(electricityReading.id, current.id));
    });

    res.json({ message: "Reading deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete reading" });
  }
});

export default router;
