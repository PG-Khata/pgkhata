import { Router } from "express";
import { db, notification, property } from "@pgkhata/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner);

// List notifications for a property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = req.query.propertyId as string | undefined;

    let where;
    if (propertyId) {
      where = eq(notification.propertyId, propertyId);
    } else {
      // Get all properties for owner
      const props = await db
        .select({ id: property.id })
        .from(property)
        .where(eq(property.ownerId, req.ownerId!));
      const ids = props.map((p) => p.id);
      if (ids.length === 0) return res.json([]);
      where = sql`${notification.propertyId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
    }

    const rows = await db
      .select()
      .from(notification)
      .where(where)
      .orderBy(desc(notification.createdAt))
      .limit(50);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Get unread count
router.get("/unread-count", async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = req.query.propertyId as string | undefined;

    let where;
    if (propertyId) {
      where = and(eq(notification.propertyId, propertyId), eq(notification.read, false));
    } else {
      const props = await db
        .select({ id: property.id })
        .from(property)
        .where(eq(property.ownerId, req.ownerId!));
      const ids = props.map((p) => p.id);
      if (ids.length === 0) return res.json({ count: 0 });
      where = and(
        sql`${notification.propertyId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
        eq(notification.read, false),
      );
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notification)
      .where(where);

    res.json({ count: row?.count ?? 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to count notifications" });
  }
});

// Mark single as read
router.put("/:notificationId/read", async (req: AuthenticatedRequest, res) => {
  try {
    const [updated] = await db
      .update(notification)
      .set({ read: true })
      .where(eq(notification.id, param(req, "notificationId")))
      .returning();

    if (!updated) return res.status(404).json({ error: "Notification not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// Mark all as read
router.post("/mark-all-read", async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = req.body.propertyId as string | undefined;

    let where;
    if (propertyId) {
      where = and(eq(notification.propertyId, propertyId), eq(notification.read, false));
    } else {
      const props = await db
        .select({ id: property.id })
        .from(property)
        .where(eq(property.ownerId, req.ownerId!));
      const ids = props.map((p) => p.id);
      if (ids.length === 0) return res.json({ updated: 0 });
      where = and(
        sql`${notification.propertyId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
        eq(notification.read, false),
      );
    }

    const result = await db
      .update(notification)
      .set({ read: true })
      .where(where);

    res.json({ message: "All marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

export default router;
