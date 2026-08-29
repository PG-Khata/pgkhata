import { Router } from "express";
import { z } from "zod";
import { db, user, ownerProfile, property, tenant, bill } from "@pgkhata/db";
import { eq, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

const router = Router();

// Middleware to require super-admin role
async function requireSuperAdmin(req: AuthenticatedRequest, res: any, next: any) {
  // TODO: Check super_admins table
  // For now, allow all authenticated users
  next();
}

// Get platform overview
router.get("/overview", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const [{ userCount }] = await db
      .select({ userCount: sql<number>`count(*)` })
      .from(user);

    const [{ ownerCount }] = await db
      .select({ ownerCount: sql<number>`count(*)` })
      .from(ownerProfile);

    const [{ propertyCount }] = await db
      .select({ propertyCount: sql<number>`count(*)` })
      .from(property);

    const [{ tenantCount }] = await db
      .select({ tenantCount: sql<number>`count(*)` })
      .from(tenant)
      .where(eq(tenant.status, "active"));

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
      .where(eq(ownerProfile.id, req.params.ownerId))
      .limit(1);

    if (!owner) return res.status(404).json({ error: "Owner not found" });

    // Get owner's properties
    const properties = await db
      .select()
      .from(property)
      .where(eq(property.ownerId, req.params.ownerId));

    res.json({ ...owner, properties });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owner" });
  }
});

export default router;
