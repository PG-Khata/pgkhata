import { Router } from "express";
import { db, notification, property } from "@pgkhata/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner);

/** Get property IDs owned by the authenticated owner. */
async function getOwnerPropertyIds(ownerId: string): Promise<string[]> {
  const props = await db
    .select({ id: property.id })
    .from(property)
    .where(eq(property.ownerId, ownerId));
  return props.map((p) => p.id);
}

/** Build a WHERE clause scoped to the owner's properties, optionally filtered to one. */
function buildOwnerScopedWhere(
  ownerPropertyIds: string[],
  filterPropertyId?: string,
) {
  if (ownerPropertyIds.length === 0) return undefined;

  if (filterPropertyId) {
    // Verify the requested propertyId belongs to this owner
    if (!ownerPropertyIds.includes(filterPropertyId)) {
      return undefined; // Will result in empty results
    }
    return eq(notification.propertyId, filterPropertyId);
  }

  return inArray(notification.propertyId, ownerPropertyIds);
}

// List notifications for a property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const ownerPropertyIds = await getOwnerPropertyIds(req.ownerId!);
    const propertyId = req.query.propertyId as string | undefined;

    const where = buildOwnerScopedWhere(ownerPropertyIds, propertyId);
    if (!where) return res.json([]);

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
    const ownerPropertyIds = await getOwnerPropertyIds(req.ownerId!);
    const propertyId = req.query.propertyId as string | undefined;

    const scopedWhere = buildOwnerScopedWhere(ownerPropertyIds, propertyId);
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
    const ownerPropertyIds = await getOwnerPropertyIds(req.ownerId!);

    if (ownerPropertyIds.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const [updated] = await db
      .update(notification)
      .set({ read: true })
      .where(
        and(
          eq(notification.id, notificationId),
          inArray(notification.propertyId, ownerPropertyIds),
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
    const ownerPropertyIds = await getOwnerPropertyIds(req.ownerId!);
    const propertyId = req.body.propertyId as string | undefined;

    const scopedWhere = buildOwnerScopedWhere(ownerPropertyIds, propertyId);
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
