import type { Response, NextFunction } from "express";
import { db, platformAdmin, type PlatformAdminRole } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "./auth";

export interface AdminContext {
  id: string;
  userId: string;
  role: PlatformAdminRole;
}

/**
 * Requires an active platform admin, optionally in one of `roles`.
 * Called with no arguments it accepts either role, which is what the read-heavy
 * admin routes want.
 *
 * Does NOT set req.ownerId — admin routes bypass owner scoping entirely.
 */
export function requireAdmin(...roles: PlatformAdminRole[]) {
  async function adminGuard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // An impersonated request carries an owner's scope and arrived on the owner
    // origin. Whatever minted it, it must never cross back into the admin
    // surface, or impersonation becomes a privilege loop: act as an owner, then
    // use that to act as the platform.
    if (req.impersonation) {
      return res.status(403).json({ error: "Platform admin access required" });
    }

    try {
      const [admin] = await db
        .select({
          id: platformAdmin.id,
          userId: platformAdmin.userId,
          role: platformAdmin.role,
          isActive: platformAdmin.isActive,
        })
        .from(platformAdmin)
        .where(eq(platformAdmin.userId, req.user.id))
        .limit(1);

      // Deactivation is revocation: it must deny exactly like a missing row,
      // and must not leak which of the two it was.
      if (!admin || !admin.isActive) {
        return res.status(403).json({ error: "Platform admin access required" });
      }

      const role = admin.role as PlatformAdminRole;
      if (roles.length > 0 && !roles.includes(role)) {
        return res.status(403).json({ error: "Insufficient platform admin role" });
      }

      req.admin = { id: admin.id, userId: admin.userId, role };
      next();
    } catch (error) {
      next(error);
    }
  }

  // Encode the accepted roles in the function name so the mounted router stack
  // is self-describing. `admin-route-guards.test.ts` reads this to prove every
  // admin route is guarded and that the destructive ones require super_admin —
  // a check that keeps working for routes nobody has written yet.
  Object.defineProperty(adminGuard, "name", {
    value: `adminGuard:${roles.length > 0 ? roles.join("|") : "any"}`,
  });
  return adminGuard;
}

/** Any active admin, either role. */
export const requirePlatformAdmin = requireAdmin();

/** Destructive and privilege-changing routes only. */
export const requireSuperAdminRole = requireAdmin("super_admin");
