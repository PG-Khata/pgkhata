import { Router } from "express";
import { db, bed, room } from "@pgkhata/db";
import { eq, and, asc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { pagination, sendPage } from "../lib/pagination";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner, requireProperty);

/** Beds of one room: /v1/properties/:pid/rooms/:roomId/beds */
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const page = pagination(req);
    const roomId = param(req, "roomId");

    const [target] = await db
      .select({ id: room.id })
      .from(room)
      .where(and(eq(room.id, roomId), eq(room.propertyId, req.propertyId!)))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Room not found" });

    const beds = await db
      .select()
      .from(bed)
      .where(eq(bed.roomId, roomId))
      .orderBy(asc(bed.number))
      .limit(page.limit)
      .offset(page.offset);

    sendPage(res, beds, page);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch beds" });
  }
});

export default router;
