import { Router } from "express";
import { z } from "zod";
import { db, ownerProfile } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { param } from "../../lib/http";
import { captureBefore } from "../../lib/audit";

/**
 * Owner account lifecycle.
 *
 * Support had exactly two options before this: leave a problem account fully
 * operational, or delete it. Suspension is the missing middle — reversible,
 * attributed, and enforced in one place (`requireOwner`) rather than by each of
 * the ~28 owner routers.
 *
 * What suspension does NOT do, deliberately:
 *
 *  - It does not revoke Better Auth sessions. Those live in a separate store, so
 *    a suspended owner can still sign in; they simply meet a 403 on every owner
 *    route. Killing their sessions is a defensible extra step for an *abuse*
 *    suspension, and the wrong behaviour for the common case — a billing hold or
 *    a migration window that ends in minutes and should not log a paying
 *    customer out of their own business mid-task. If that becomes a requirement
 *    it belongs behind an explicit flag on this endpoint, not as a silent
 *    side effect of every pause.
 *
 *  - It does not touch anything below the owner. No property, tenant, bill or
 *    payment is reachable except through an owner, so the account boundary is
 *    the whole enforcement surface and a per-table `deleted_at` would be four
 *    dozen new ways to get it wrong.
 *
 *  - It does not block support. `requireOwner` lets an impersonated request
 *    through regardless of status, because the suspended account is precisely
 *    the one that needs investigating.
 *
 * `requireSuperAdminRole` is applied per route and never via `router.use`: every
 * admin sub-router is mounted at "/", so router-level middleware here would run
 * for requests a *sibling* router handles. That is not hypothetical — it is what
 * made `support` admins get 403 from the impersonation endpoint.
 */
const router = Router();

const suspendSchema = z.object({
  // An unexplained suspension is the thing the audit trail exists to prevent,
  // and "test" or "abc" is not an explanation the customer can be read back.
  reason: z.string().trim().min(10, "Give a reason of at least 10 characters").max(500),
});

router.post(
  "/owners/:ownerId/suspend",
  requireSuperAdminRole,
  async (req: AuthenticatedRequest, res) => {
    const ownerId = param(req, "ownerId");
    const parsed = suspendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    // Read-then-write in one transaction so the audit entry's `before` is the
    // row this statement actually replaced, not one read a moment earlier.
    const result = await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(ownerProfile)
        .where(eq(ownerProfile.id, ownerId))
        .limit(1);
      if (!before) return { code: "not_found" as const };

      // Suspending an account already on its way out is not a pause, it is a
      // contradiction: reactivating it later would silently resurrect it.
      if (before.status === "pending_deletion" || before.status === "deleted") {
        return { code: "conflict" as const, status: before.status };
      }

      captureBefore(req, before);

      const [row] = await tx
        .update(ownerProfile)
        .set({
          status: "suspended",
          // Re-suspending keeps the original timestamp: the pause started when
          // it started, and "suspended since" is the question support is asked.
          // The reason and the attribution do move — the latest justification is
          // the operative one, and the previous pair is preserved in the audit
          // log's before-image.
          suspendedAt: before.suspendedAt ?? new Date(),
          suspendedReason: parsed.data.reason,
          suspendedBy: req.admin!.userId,
          updatedAt: new Date(),
        })
        .where(eq(ownerProfile.id, ownerId))
        .returning();

      return { code: "ok" as const, row: row ?? null };
    });

    if (result.code === "not_found") return res.status(404).json({ error: "Owner not found" });
    if (result.code === "conflict") {
      return res
        .status(409)
        .json({ error: `Cannot suspend an owner with status '${result.status}'` });
    }
    if (!result.row) return res.status(404).json({ error: "Owner not found" });
    res.json(result.row);
  },
);

router.post(
  "/owners/:ownerId/reactivate",
  requireSuperAdminRole,
  async (req: AuthenticatedRequest, res) => {
    const ownerId = param(req, "ownerId");

    const result = await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(ownerProfile)
        .where(eq(ownerProfile.id, ownerId))
        .limit(1);
      if (!before) return { code: "not_found" as const };

      // Undeleting is a different, staged operation with its own decisions about
      // what is still safe to restore. It must not be reachable by typing the
      // reactivate URL.
      if (before.status === "pending_deletion" || before.status === "deleted") {
        return { code: "conflict" as const, status: before.status };
      }

      // Idempotent: a retried request, or a second admin clicking the same
      // button, is a no-op rather than a 409 someone has to interpret.
      if (before.status === "active") return { code: "ok" as const, row: before };

      captureBefore(req, before);

      const [row] = await tx
        .update(ownerProfile)
        .set({
          status: "active",
          // Cleared rather than kept: the columns describe the *current* pause,
          // and a stale reason on a live account reads as an active suspension.
          // The history of who paused it, why, and when is in admin_audit_log,
          // which is append-only and harder to erase than this row.
          suspendedAt: null,
          suspendedReason: null,
          suspendedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(ownerProfile.id, ownerId))
        .returning();

      return { code: "ok" as const, row: row ?? null };
    });

    if (result.code === "not_found") return res.status(404).json({ error: "Owner not found" });
    if (result.code === "conflict") {
      return res
        .status(409)
        .json({ error: `Cannot reactivate an owner with status '${result.status}'` });
    }
    if (!result.row) return res.status(404).json({ error: "Owner not found" });
    res.json(result.row);
  },
);

export default router;
