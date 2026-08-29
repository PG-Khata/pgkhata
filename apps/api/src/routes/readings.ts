import { Router } from "express";
import { z } from "zod";
import { db, electricityReading, room, property } from "@pgkhata/db";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";

const router = Router({ mergeParams: true });

const createReadingSchema = z.object({
  roomId: z.string().uuid(),
  reading: z.number().min(0),
  readingDate: z.string().transform((str) => new Date(str)),
});

async function verifyPropertyOwnership(req: AuthenticatedRequest, res: any, next: any) {
  const [prop] = await db
    .select()
    .from(property)
    .where(and(eq(property.id, req.params.propertyId), eq(property.ownerId, req.ownerId!)))
    .limit(1);
  if (!prop) return res.status(404).json({ error: "Property not found" });
  next();
}

// Get readings for a room
router.get("/", requireAuth, requireOwner, verifyPropertyOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const readings = await db
      .select()
      .from(electricityReading)
      .where(eq(electricityReading.roomId, req.query.roomId as string))
      .orderBy(desc(electricityReading.readingDate));
    res.json(readings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});

// Create reading
router.post("/", requireAuth, requireOwner, verifyPropertyOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const body = createReadingSchema.parse(req.body);

    // Verify room belongs to property
    const [r] = await db
      .select()
      .from(room)
      .where(and(eq(room.id, body.roomId), eq(room.propertyId, req.params.propertyId)))
      .limit(1);
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
