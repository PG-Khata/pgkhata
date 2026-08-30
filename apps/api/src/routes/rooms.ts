import { Router } from "express";
import { z } from "zod";
import { db, room } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

const createRoomSchema = z.object({
  number: z.string().min(1).max(20),
  type: z.enum(["single", "double", "triple", "dormitory"]).default("single"),
  capacity: z.number().min(1).max(20).default(1),
  monthlyRent: z.number().min(0),
});

const updateRoomSchema = createRoomSchema.partial();

router.use(requireAuth, requireOwner, requireProperty);

// Get all rooms for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const rooms = await db
      .select()
      .from(room)
      .where(eq(room.propertyId, req.propertyId!));

    res.json(rooms);
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

    // Check for duplicate room number
    const [existing] = await db
      .select()
      .from(room)
      .where(
        and(
          eq(room.propertyId, req.propertyId!),
          eq(room.number, body.number)
        )
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "Room number already exists" });
    }

    const [newRoom] = await db
      .insert(room)
      .values({
        ...body,
        propertyId: req.propertyId!,
      })
      .returning();

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
