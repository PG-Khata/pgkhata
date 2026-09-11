import type { Response, NextFunction } from "express";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, impersonationSession, ownerProfile, platformAdmin, user } from "@pgkhata/db";
import type { AuthenticatedRequest } from "./auth";
import { IMPERSONATION_COOKIE, hashToken } from "../lib/impersonation";
import { readCookie, clearSecureCookie } from "../lib/cookies";

const adminUser = alias(user, "admin_user");
const targetUser = alias(user, "target_user");

export interface ImpersonationContext {
  sessionId: string;
  adminId: string;
  adminUserId: string;
  adminName: string;
  adminEmail: string;
  targetOwnerId: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  mode: "read_only" | "read_write";
  canWrite: boolean;
  reason: string;
  writeReason: string | null;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  writeExpiresAt: Date | null;
}

/**
 * Mounted once, globally, in index.ts — before any router. Owner routers are
 * mounted individually there, so anything scoped per-router is one forgotten
 * `router.use` away from a tenancy bypass; a global resolver cannot be
 * forgotten by a route that does not exist yet.
 *
 * Never rejects. A missing, expired or revoked cookie simply means "not
 * impersonating", and the request continues as an ordinary one.
 */
export async function resolveImpersonation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = readCookie(req, IMPERSONATION_COOKIE);
  if (!token) return next();

  try {
    const [row] = await db
      .select({
        sessionId: impersonationSession.id,
        adminId: impersonationSession.adminId,
        adminUserId: impersonationSession.adminUserId,
        adminName: adminUser.name,
        adminEmail: adminUser.email,
        targetOwnerId: impersonationSession.targetOwnerId,
        targetUserId: ownerProfile.userId,
        targetUserEmail: targetUser.email,
        targetUserName: targetUser.name,
        mode: impersonationSession.mode,
        reason: impersonationSession.reason,
        writeReason: impersonationSession.writeReason,
        expiresAt: impersonationSession.expiresAt,
        absoluteExpiresAt: impersonationSession.absoluteExpiresAt,
        writeExpiresAt: impersonationSession.writeExpiresAt,
        adminActive: platformAdmin.isActive,
      })
      .from(impersonationSession)
      .innerJoin(platformAdmin, eq(platformAdmin.id, impersonationSession.adminId))
      .innerJoin(adminUser, eq(adminUser.id, impersonationSession.adminUserId))
      .innerJoin(ownerProfile, eq(ownerProfile.id, impersonationSession.targetOwnerId))
      .innerJoin(targetUser, eq(targetUser.id, ownerProfile.userId))
      .where(
        and(
          eq(impersonationSession.sessionTokenHash, hashToken(token)),
          isNull(impersonationSession.endedAt),
          gt(impersonationSession.expiresAt, sql`now()`),
        ),
      )
      .limit(1);

    // No live row, or the grantee has since been deactivated or removed from
    // the admin table: the grant dies with the grantee, not at its own expiry.
    if (!row || !row.adminActive) {
      clearSecureCookie(res, IMPERSONATION_COOKIE);
      return next();
    }

    req.impersonation = {
      sessionId: row.sessionId,
      adminId: row.adminId,
      adminUserId: row.adminUserId,
      adminName: row.adminName,
      adminEmail: row.adminEmail,
      targetOwnerId: row.targetOwnerId,
      targetUserId: row.targetUserId,
      targetUserEmail: row.targetUserEmail,
      targetUserName: row.targetUserName,
      mode: row.mode as "read_only" | "read_write",
      canWrite:
        row.mode === "read_write" &&
        row.writeExpiresAt !== null &&
        row.writeExpiresAt.getTime() > Date.now(),
      reason: row.reason,
      writeReason: row.writeReason,
      expiresAt: row.expiresAt,
      absoluteExpiresAt: row.absoluteExpiresAt,
      writeExpiresAt: row.writeExpiresAt,
    };
    next();
  } catch (error) {
    next(error);
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The only non-GET endpoints that stay reachable while read-only, because they
 * are how you escalate or leave.
 *
 * This router must stay minimal and must never gain an endpoint that touches
 * anything other than the impersonation_session row — it is an allowlist hole
 * in the read-only guarantee.
 */
const CONTROL_PREFIX = "/v1/impersonation/";

/**
 * Mounted globally, immediately after `resolveImpersonation`. A per-router
 * guard would have to be added to every owner router and to every future one;
 * this cannot be bypassed by adding a route.
 */
export function enforceImpersonationReadOnly(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const grant = req.impersonation;
  if (!grant) return next();
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path.startsWith(CONTROL_PREFIX)) return next();
  if (grant.canWrite) return next();

  return res.status(403).json({
    error: "This support session is read-only. Request write access to continue.",
    code: "IMPERSONATION_READ_ONLY",
    requestId: req.headers["x-request-id"],
  });
}
