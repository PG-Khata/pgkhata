import { Router } from "express";
import { db, platformAdmin } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import { type AuthenticatedRequest, requireAuth } from "../../middleware/auth";
import { requirePlatformAdmin } from "../../middleware/admin";
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
import metricsRouter from "./metrics";
import commsRouter from "./comms";

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
router.use(metricsRouter);
router.use(commsRouter);

// Last: turns a database constraint failure into the status it actually means
// before the app-wide handler in src/index.ts sees it.
router.use(adminErrorTranslator);

export default router;
