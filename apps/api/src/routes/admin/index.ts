import { Router } from "express";
import { db, user, ownerProfile, property, tenant, bill, platformAdmin } from "@pgkhata/db";
import { eq, sql, and } from "drizzle-orm";
import { type AuthenticatedRequest, requireAuth } from "../../middleware/auth";
import { requirePlatformAdmin } from "../../middleware/admin";
import { aggregate } from "../../lib/http";
import { adminErrorTranslator } from "./errors";
import ownersRouter from "./owners";
import propertiesRouter from "./properties";
import tenantsRouter from "./tenants";
import billingRouter from "./billing";
import paymentsRouter from "./payments";
import structureRouter from "./structure";
import blogRouter from "./blog";
import auditRouter from "./audit";
import adminsRouter from "./admins";
import impersonationRouter from "./impersonation";
import searchRouter from "./search";
import overviewRouter from "./overview";
import lifecycleRouter from "./lifecycle";

const router = Router();

/**
 * One gate for the entire admin surface.
 *
 * This used to be repeated by hand on all ~39 routes, which made the safety of
 * `/v1/admin` a property of every future diff rather than of this file: one
 * forgotten pair on a new route and cross-owner platform data is served to
 * anyone with a session. Applied here it cannot be forgotten, because a route
 * cannot be mounted without passing through it.
 *
 * Sub-routers only ever *narrow* this, with `requireSuperAdminRole` on the
 * routes that destroy data or hand out privilege. None of them may widen it.
 */
router.use(requireAuth, requirePlatformAdmin);

/**
 * The admin app's server-side route gate calls this before rendering the shell.
 * A non-200 here is the signal to redirect to /login, so it must stay cheap.
 */
router.get("/me", async (req: AuthenticatedRequest, res) => {
  // Best-effort recency touch; a failure here must never block the gate.
  void db
    .update(platformAdmin)
    .set({ lastLoginAt: new Date() })
    .where(eq(platformAdmin.id, req.admin!.id))
    .catch(() => {});

  res.json({
    id: req.admin!.id,
    userId: req.admin!.userId,
    role: req.admin!.role,
    name: req.user!.name,
    email: req.user!.email,
  });
});

router.get("/analytics", async (_req, res) => {
  const [userRows, ownerRows, propertyRows, tenantRows] = await Promise.all([
    db.select({ userCount: sql<number>`count(*)::int` }).from(user),
    db.select({ ownerCount: sql<number>`count(*)::int` }).from(ownerProfile),
    db.select({ propertyCount: sql<number>`count(*)::int` }).from(property),
    db
      .select({ tenantCount: sql<number>`count(*)::int` })
      .from(tenant)
      .where(eq(tenant.status, "active")),
  ]);

  res.json({
    totalUsers: aggregate(userRows, { userCount: 0 }).userCount,
    totalOwners: aggregate(ownerRows, { ownerCount: 0 }).ownerCount,
    totalProperties: aggregate(propertyRows, { propertyCount: 0 }).propertyCount,
    activeTenants: aggregate(tenantRows, { tenantCount: 0 }).tenantCount,
  });
});

/** Cumulative totals at the end of each of the last six months. */
router.get("/analytics/trends", async (_req, res) => {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7); // YYYY-MM
  });

  const trends = await Promise.all(
    months.map(async (month) => {
      const [ownerRows, propertyRows, tenantRows, billRows] = await Promise.all([
        db
          .select({ ownerCount: sql<number>`count(*)::int` })
          .from(ownerProfile)
          .where(sql`to_char(${ownerProfile.createdAt}, 'YYYY-MM') <= ${month}`),
        db
          .select({ propertyCount: sql<number>`count(*)::int` })
          .from(property)
          .where(sql`to_char(${property.createdAt}, 'YYYY-MM') <= ${month}`),
        db
          .select({ tenantCount: sql<number>`count(*)::int` })
          .from(tenant)
          .where(
            and(
              eq(tenant.status, "active"),
              sql`to_char(${tenant.joiningDate}, 'YYYY-MM') <= ${month}`,
            ),
          ),
        // Billed and collected come off the same rows; two queries scanned the
        // same range twice for no reason.
        db
          .select({
            billed: sql<number>`coalesce(sum(${bill.totalAmount}), 0)::int`,
            collected: sql<number>`coalesce(sum(${bill.paidAmount}), 0)::int`,
          })
          .from(bill)
          .where(sql`to_char(${bill.createdAt}, 'YYYY-MM') <= ${month}`),
      ]);

      const { billed, collected } = aggregate(billRows, { billed: 0, collected: 0 });
      return {
        month,
        owners: aggregate(ownerRows, { ownerCount: 0 }).ownerCount,
        properties: aggregate(propertyRows, { propertyCount: 0 }).propertyCount,
        tenants: aggregate(tenantRows, { tenantCount: 0 }).tenantCount,
        billed,
        collected,
      };
    }),
  );

  res.json(trends);
});

// Mounted at the root so each sub-router keeps its full, greppable path. Order
// is irrelevant: Express matches a route's whole path, so `/properties/:id` and
// `/properties/:id/structure` never contend.
router.use(ownersRouter);
router.use(propertiesRouter);
router.use(tenantsRouter);
router.use(billingRouter);
router.use(paymentsRouter);
router.use(structureRouter);
router.use(blogRouter);
router.use(auditRouter);
router.use(adminsRouter);
router.use(impersonationRouter);
router.use(searchRouter);
router.use(overviewRouter);
router.use(lifecycleRouter);

// Last: turns a database constraint failure into the status it actually means
// before the app-wide handler in src/index.ts sees it.
router.use(adminErrorTranslator);

export default router;
