import { Router } from "express";
import { z } from "zod";
import { db, electricityReading, room } from "@pgkhata/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { pagination, sendPage } from "../lib/pagination";

const router = Router({ mergeParams: true });

const createReadingSchema = z.object({
  roomId: z.string().uuid(),
  reading: z.number().min(0),
  readingDate: z.string().transform((str) => new Date(str)),
});
const batchReadingSchema = z.object({
  readings: z.array(createReadingSchema).min(1).max(100),
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
    const page = pagination(req);
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
        .orderBy(desc(electricityReading.readingDate))
        .limit(page.limit)
        .offset(page.offset);

      return sendPage(res, readings, page);
    }

    const readings = await db
      .select({
        reading: electricityReading,
        roomNumber: room.number,
      })
      .from(electricityReading)
      .innerJoin(room, eq(electricityReading.roomId, room.id))
      .where(eq(room.propertyId, req.propertyId!))
      .orderBy(desc(electricityReading.readingDate))
      .limit(page.limit)
      .offset(page.offset);

    sendPage(res, readings, page);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: "Failed to create reading" });
  }
});

// Save a preflight batch atomically. This deliberately shares the same
// ownership and monotonic rules as the single-reading endpoint.
router.post("/batch", async (req: AuthenticatedRequest, res) => {
  try {
    const { readings } = batchReadingSchema.parse(req.body);
    const created = await db.transaction(async (tx) => {
      const rows: (typeof electricityReading.$inferSelect)[] = [];
      const byRoom = new Map<string, typeof readings>();
      for (const input of readings) {
        const bucket = byRoom.get(input.roomId);
        if (bucket) bucket.push(input);
        else byRoom.set(input.roomId, [input]);
      }

      for (const [roomId, inputs] of byRoom) {
        const [owned] = await tx.select({ id: room.id }).from(room)
          .where(and(eq(room.id, roomId), eq(room.propertyId, req.propertyId!))).limit(1);
        if (!owned) throw new Error("ROOM_NOT_FOUND");

        const existing = await tx.select().from(electricityReading)
          .where(eq(electricityReading.roomId, roomId)).orderBy(asc(electricityReading.readingDate));
        const timeline = [
          ...existing.map((row) => ({ kind: "existing" as const, row, reading: row.reading, readingDate: row.readingDate })),
          ...inputs.map((input) => ({ kind: "input" as const, input, reading: input.reading, readingDate: input.readingDate })),
        ].sort((a, b) => a.readingDate.getTime() - b.readingDate.getTime());

        for (let index = 0; index < timeline.length; index += 1) {
          const current = timeline[index]!;
          const previous = timeline[index - 1];
          if (previous && (current.readingDate.getTime() === previous.readingDate.getTime() || current.reading < previous.reading)) {
            throw new Error("INVALID_READING_POSITION");
          }
        }

        for (let index = 0; index < timeline.length; index += 1) {
          const current = timeline[index]!;
          const previous = timeline[index - 1];
          const units = previous ? current.reading - previous.reading : 0;
          if (current.kind === "input") {
            const [row] = await tx.insert(electricityReading).values({
              roomId,
              reading: current.reading,
              readingDate: current.readingDate,
              units,
            }).returning();
            if (!row) throw new Error("FAILED_TO_CREATE_READING");
            rows.push(row);
          } else if (current.row.units !== units) {
            await tx.update(electricityReading).set({ units }).where(eq(electricityReading.id, current.row.id));
          }
        }
      }
      return rows;
    });
    res.status(201).json({ readings: created });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.issues });
    if (error instanceof Error && error.message === "ROOM_NOT_FOUND") return res.status(404).json({ error: "Room not found" });
    if (error instanceof Error && error.message === "INVALID_READING_POSITION") return res.status(400).json({ error: "Reading date and value must be later than the room's previous reading" });
    res.status(500).json({ error: "Failed to create readings" });
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
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
