import type { Response, NextFunction } from "express";
import { db, platformAdmin } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "./auth";

/**
 * Requires the authenticated user to be a platform super-admin.
 * Does NOT set req.ownerId — admin routes bypass owner scoping entirely.
 */
export async function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
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
