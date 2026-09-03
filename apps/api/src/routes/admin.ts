import { Router } from "express";
import { db, user, ownerProfile, property, tenant, platformAdmin } from "@pgkhata/db";
import { eq, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { param, aggregate } from "../lib/http";

const router = Router();

// Middleware to require super-admin role
async function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: any,
  next: () => void,
) {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const [admin] = await db
    .select({ id: platformAdmin.id })
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, req.user.id))
    .limit(1);

  if (!admin) {
    return res.status(403).json({ error: "Platform admin access required" });
  }

  next();
}

// Get platform overview
router.get("/overview", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userCount } = aggregate(
      await db.select({ userCount: sql<number>`count(*)::int` }).from(user),
      { userCount: 0 },
    );

    const { ownerCount } = aggregate(
      await db.select({ ownerCount: sql<number>`count(*)::int` }).from(ownerProfile),
      { ownerCount: 0 },
    );

    const { propertyCount } = aggregate(
      await db.select({ propertyCount: sql<number>`count(*)::int` }).from(property),
      { propertyCount: 0 },
    );

    const { tenantCount } = aggregate(
      await db
        .select({ tenantCount: sql<number>`count(*)::int` })
        .from(tenant)
        .where(eq(tenant.status, "active")),
      { tenantCount: 0 },
    );

    res.json({
      totalUsers: userCount,
      totalOwners: ownerCount,
      totalProperties: propertyCount,
      activeTenants: tenantCount,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// Get all owners
router.get("/owners", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const owners = await db
      .select({
        owner: ownerProfile,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(ownerProfile)
      .leftJoin(user, eq(ownerProfile.userId, user.id));

    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owners" });
  }
});

// Get owner details
router.get("/owners/:ownerId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = param(req, "ownerId");

    const [owner] = await db
      .select({
        owner: ownerProfile,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(ownerProfile)
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(eq(ownerProfile.id, ownerId))
      .limit(1);

    if (!owner) return res.status(404).json({ error: "Owner not found" });

    // Get owner's properties
    const properties = await db
      .select()
      .from(property)
      .where(eq(property.ownerId, ownerId));

    res.json({ ...owner, properties });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owner" });
  }
});

export default router;
