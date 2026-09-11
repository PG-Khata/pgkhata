import { Router, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, adminAuditLog, impersonationSession, ownerProfile, user } from "@pgkhata/db";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  IMPERSONATION_COOKIE,
  MIN_REASON_LENGTH,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_TTL_MS,
  WRITE_WINDOW_MS,
  adminAppUrl,
  clientIp,
  hashToken,
  mintToken,
  userAgent,
} from "../lib/impersonation";
import { clearSecureCookie, setSecureCookie } from "../lib/cookies";
import { logger } from "../lib/logger";
import { sendEmail, supportWriteAccessEmail } from "@pgkhata/email";

const router = Router();

const reasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(MIN_REASON_LENGTH, `Please describe the reason in at least ${MIN_REASON_LENGTH} characters`)
    .max(500),
});

/**
 * Narrows to a live grant, answering 404 when there is none. Returns null so
 * callers read as `const grant = requireGrant(...); if (!grant) return;`.
 */
function requireGrant(req: AuthenticatedRequest, res: Response) {
  if (!req.impersonation) {
    res.status(404).json({ error: "No active support session" });
    return null;
  }
  return req.impersonation;
}

/**
 * Exchanges the one-time handoff token for the session cookie, on the owner
 * origin. Unauthenticated by design: the token *is* the credential, and it was
 * minted moments ago for an authenticated, active platform admin.
 */
router.post("/claim", async (req: AuthenticatedRequest, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : null;
  if (!token) return res.status(400).json({ error: "Missing token" });

  const sessionToken = mintToken();
  const now = new Date();

  // Single-use compare-and-swap. Two concurrent claims cannot both win, because
  // the handoff_claimed_at IS NULL predicate is evaluated under row lock.
  const [claimed] = await db
    .update(impersonationSession)
    .set({
      handoffClaimedAt: now,
      sessionTokenHash: hashToken(sessionToken),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      ipAddress: clientIp(req),
      userAgent: userAgent(req),
    })
    .where(
      and(
        eq(impersonationSession.handoffTokenHash, hashToken(token)),
        isNull(impersonationSession.handoffClaimedAt),
        isNull(impersonationSession.endedAt),
        sql`${impersonationSession.handoffExpiresAt} > now()`,
      ),
    )
    .returning({
      id: impersonationSession.id,
      adminId: impersonationSession.adminId,
      adminUserId: impersonationSession.adminUserId,
      targetOwnerId: impersonationSession.targetOwnerId,
      reason: impersonationSession.reason,
      expiresAt: impersonationSession.expiresAt,
    });

  if (!claimed) {
    return res.status(401).json({ error: "This support link is invalid or has already been used" });
  }

  await db.insert(adminAuditLog).values({
    adminId: claimed.adminId,
    adminUserId: claimed.adminUserId,
    adminEmail: "",
    impersonationSessionId: claimed.id,
    action: "impersonation.claim",
    entityType: "owner",
    entityId: claimed.targetOwnerId,
    ownerId: claimed.targetOwnerId,
    method: req.method,
    path: req.path,
    statusCode: 200,
    reason: claimed.reason,
    ipAddress: clientIp(req),
    userAgent: userAgent(req),
    requestId: (req.headers["x-request-id"] as string) ?? null,
  });

  setSecureCookie(res, IMPERSONATION_COOKIE, sessionToken, SESSION_TTL_MS);
  res.json({ ok: true, expiresAt: claimed.expiresAt });
});

/**
 * Drives the owner-app banner. Returns `active: false` for a genuine owner, so
 * the banner can render unconditionally and simply disappear.
 */
router.get("/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  const grant = req.impersonation;
  if (!grant) return res.json({ active: false });

  res.json({
    active: true,
    adminName: grant.adminName,
    ownerName: grant.targetUserName,
    mode: grant.mode,
    canWrite: grant.canWrite,
    reason: grant.reason,
    expiresAt: grant.expiresAt,
    writeExpiresAt: grant.writeExpiresAt,
    absoluteExpiresAt: grant.absoluteExpiresAt,
  });
});

/**
 * Opens a time-boxed write window. Re-callable to re-arm a lapsed window, which
 * requires a fresh justification each time.
 */
router.post("/escalate", requireAuth, async (req: AuthenticatedRequest, res) => {
  const grant = requireGrant(req, res);
  if (!grant) return;

  const parsed = reasonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const now = new Date();
  const writeExpiresAt = new Date(now.getTime() + WRITE_WINDOW_MS);

  const [updated] = await db
    .update(impersonationSession)
    .set({
      mode: "read_write",
      writeReason: parsed.data.reason,
      writeGrantedAt: now,
      writeExpiresAt,
    })
    .where(and(eq(impersonationSession.id, grant.sessionId), isNull(impersonationSession.endedAt)))
    .returning({ id: impersonationSession.id });

  if (!updated) return res.status(409).json({ error: "This support session has ended" });

  // Durable before the window opens: the record of why must not be able to lose
  // a race with the write it authorises.
  await db.insert(adminAuditLog).values({
    adminId: grant.adminId,
    adminUserId: grant.adminUserId,
    adminEmail: grant.adminEmail,
    impersonationSessionId: grant.sessionId,
    action: "impersonation.escalate",
    entityType: "owner",
    entityId: grant.targetOwnerId,
    ownerId: grant.targetOwnerId,
    method: req.method,
    path: req.path,
    statusCode: 200,
    reason: parsed.data.reason,
    ipAddress: clientIp(req),
    userAgent: userAgent(req),
    requestId: (req.headers["x-request-id"] as string) ?? null,
  });

  // Write access is the only state in which the owner's data can change, so it
  // is the only state worth an email. Read-only sessions stay silent and are
  // visible in the owner's own support-access log instead.
  void sendEmail({
    to: grant.targetUserEmail,
    subject: "PGKhata Support made changes to your account",
    html: supportWriteAccessEmail({
      ownerName: grant.targetUserName,
      adminName: grant.adminName,
      reason: parsed.data.reason,
      grantedAt: now,
      expiresAt: writeExpiresAt,
    }),
  }).catch((error) =>
    logger.error({ err: error, sessionId: grant.sessionId }, "Support escalation email failed"),
  );

  res.json({ mode: "read_write", writeExpiresAt });
});

/** Renews in fixed steps, never past the absolute ceiling. */
router.post("/extend", requireAuth, async (req: AuthenticatedRequest, res) => {
  const grant = requireGrant(req, res);
  if (!grant) return;

  const [updated] = await db
    .update(impersonationSession)
    .set({
      expiresAt: sql`least(now() + interval '${sql.raw(String(SESSION_TTL_MS / 1000))} seconds', ${impersonationSession.absoluteExpiresAt})`,
    })
    .where(
      and(
        eq(impersonationSession.id, grant.sessionId),
        isNull(impersonationSession.endedAt),
        sql`${impersonationSession.absoluteExpiresAt} > now()`,
      ),
    )
    .returning({ expiresAt: impersonationSession.expiresAt });

  if (!updated) {
    return res
      .status(409)
      .json({ error: `Support sessions cannot run longer than ${SESSION_ABSOLUTE_TTL_MS / 60_000} minutes` });
  }

  res.json({ expiresAt: updated.expiresAt });
});

/** Ends the session from the owner app and clears the cookie. */
router.post("/exit", requireAuth, async (req: AuthenticatedRequest, res) => {
  const grant = requireGrant(req, res);
  if (!grant) return;

  await db
    .update(impersonationSession)
    .set({ endedAt: new Date(), endedReason: "admin_exit" })
    .where(and(eq(impersonationSession.id, grant.sessionId), isNull(impersonationSession.endedAt)));

  await db.insert(adminAuditLog).values({
    adminId: grant.adminId,
    adminUserId: grant.adminUserId,
    adminEmail: grant.adminEmail,
    impersonationSessionId: grant.sessionId,
    action: "impersonation.exit",
    entityType: "owner",
    entityId: grant.targetOwnerId,
    ownerId: grant.targetOwnerId,
    method: req.method,
    path: req.path,
    statusCode: 200,
    reason: grant.reason,
    ipAddress: clientIp(req),
    userAgent: userAgent(req),
    requestId: (req.headers["x-request-id"] as string) ?? null,
  });

  clearSecureCookie(res, IMPERSONATION_COOKIE);
  res.json({ ok: true, returnUrl: adminAppUrl() });
});

const adminUser = alias(user, "admin_user");

/**
 * The owner's own record of every time support entered their account. Zero
 * noise, full transparency, and the thing to point at when an owner asks.
 * Refuses to answer during impersonation so support cannot read it as the owner.
 */
router.get("/history", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.impersonation) {
    return res.status(403).json({ error: "Not available during a support session" });
  }

  const [profile] = await db
    .select({ id: ownerProfile.id })
    .from(ownerProfile)
    .where(eq(ownerProfile.userId, req.user!.id))
    .limit(1);
  if (!profile) return res.status(403).json({ error: "Owner profile not found" });

  const rows = await db
    .select({
      id: impersonationSession.id,
      adminName: adminUser.name,
      reason: impersonationSession.reason,
      mode: impersonationSession.mode,
      writeReason: impersonationSession.writeReason,
      writeGrantedAt: impersonationSession.writeGrantedAt,
      startedAt: impersonationSession.startedAt,
      endedAt: impersonationSession.endedAt,
    })
    .from(impersonationSession)
    .innerJoin(adminUser, eq(adminUser.id, impersonationSession.adminUserId))
    .where(
      and(
        eq(impersonationSession.targetOwnerId, profile.id),
        // Unclaimed handoffs never became access; showing them would be noise.
        sql`${impersonationSession.handoffClaimedAt} is not null`,
      ),
    )
    .orderBy(desc(impersonationSession.startedAt))
    .limit(50);

  res.json(rows);
});

export default router;
