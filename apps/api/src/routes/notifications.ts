import { Router } from "express";
import { db, notification } from "@pgkhata/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { param } from "../lib/http";
import { pagination, sendPage } from "../lib/pagination";
import { ownerPropertyIds } from "../lib/owner-scope";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner);

/** Build a WHERE clause scoped to the owner's properties, optionally filtered to one. */
function buildOwnerScopedWhere(
  propertyIds: string[],
  filterPropertyId?: string,
) {
  // No properties means no rows; returning undefined keeps the caller from
  // reaching an `inArray(..., [])`, which Postgres rejects outright.
  if (propertyIds.length === 0) return undefined;

  if (filterPropertyId) {
    // Verify the requested propertyId belongs to this owner
    if (!propertyIds.includes(filterPropertyId)) {
      return undefined; // Will result in empty results
    }
    return eq(notification.propertyId, filterPropertyId);
  }

  return inArray(notification.propertyId, propertyIds);
}

// List notifications for a property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const page = pagination(req);
    const propertyIds = await ownerPropertyIds(req.ownerId!);
    const propertyId = req.query.propertyId as string | undefined;

    const where = buildOwnerScopedWhere(propertyIds, propertyId);
    if (!where) return sendPage(res, [], page);

    const rows = await db
      .select()
      .from(notification)
      .where(where)
      .orderBy(desc(notification.createdAt))
      .limit(page.limit)
      .offset(page.offset);

    sendPage(res, rows, page);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Get unread count
router.get("/unread-count", async (req: AuthenticatedRequest, res) => {
  try {
    const propertyIds = await ownerPropertyIds(req.ownerId!);
    const propertyId = req.query.propertyId as string | undefined;

    const scopedWhere = buildOwnerScopedWhere(propertyIds, propertyId);
    if (!scopedWhere) return res.json({ count: 0 });

    const where = and(scopedWhere, eq(notification.read, false));

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notification)
      .where(where);

    res.json({ count: row?.count ?? 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to count notifications" });
  }
});

// Mark single as read — scoped to owner's properties
router.put("/:notificationId/read", async (req: AuthenticatedRequest, res) => {
  try {
    const notificationId = param(req, "notificationId");
    const propertyIds = await ownerPropertyIds(req.ownerId!);

    if (propertyIds.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const [updated] = await db
      .update(notification)
      .set({ read: true })
      .where(
        and(
          eq(notification.id, notificationId),
          inArray(notification.propertyId, propertyIds),
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Notification not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// Mark all as read — scoped to owner's properties
router.post("/mark-all-read", async (req: AuthenticatedRequest, res) => {
  try {
    const propertyIds = await ownerPropertyIds(req.ownerId!);
    const propertyId = req.body.propertyId as string | undefined;

    const scopedWhere = buildOwnerScopedWhere(propertyIds, propertyId);
    if (!scopedWhere) return res.json({ updated: 0 });

    const where = and(scopedWhere, eq(notification.read, false));

    await db
      .update(notification)
      .set({ read: true })
      .where(where);

    res.json({ message: "All marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

export default router;
