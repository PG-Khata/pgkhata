import { Router } from "express";
import { z } from "zod";
import { db, user, ownerProfile, impersonationSession, adminAuditLog } from "@pgkhata/db";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { aggregate, param } from "../../lib/http";
import {
  HANDOFF_TTL_MS,
  MIN_REASON_LENGTH,
  SESSION_ABSOLUTE_TTL_MS,
  clientIp,
  hashToken,
  mintToken,
  ownerAppUrl,
  userAgent,
} from "../../lib/impersonation";

/**
 * Support sessions. These are the replacement for the admin-side write routes
 * that were deleted: instead of re-implementing an owner mutation without its
 * guards, support steps into the owner app and uses the real one.
 *
 * Every route here stays at `requirePlatformAdmin`. Opening a read-only session
 * IS the support job and grants no write access by itself, and ending one is
 * always de-escalation.
 */

const router = Router();

const impersonateSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(MIN_REASON_LENGTH, `Please describe the reason in at least ${MIN_REASON_LENGTH} characters`)
    .max(500),
});

/** Cheap abuse ceiling; no new dependency, just a count of this hour's rows. */
const MAX_SESSIONS_PER_HOUR = 20;

/**
 * Opens a support session and returns a one-time link into the owner app.
 *
 * The session starts read-only. Nothing here grants write access, and the token
 * is single-use with a 60-second life, so the URL is worthless the moment it
 * has been followed once.
 */
router.post("/owners/:ownerId/impersonate", async (req: AuthenticatedRequest, res) => {
  const ownerId = param(req, "ownerId");
  const parsed = impersonateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const [owner] = await db
    .select({ id: ownerProfile.id, ownerName: user.name })
    .from(ownerProfile)
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .where(eq(ownerProfile.id, ownerId))
    .limit(1);
  if (!owner) return res.status(404).json({ error: "Owner not found" });

  const recent = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(impersonationSession)
    .where(
      and(
        eq(impersonationSession.adminId, req.admin!.id),
        sql`${impersonationSession.startedAt} > now() - interval '1 hour'`,
      ),
    );
  if (aggregate(recent, { count: 0 }).count >= MAX_SESSIONS_PER_HOUR) {
    return res.status(429).json({ error: "Too many support sessions started in the last hour" });
  }

  const handoffToken = mintToken();
  const now = new Date();

  const session = await db.transaction(async (tx) => {
    // One live session per admin. Enforced here rather than by a partial unique
    // index, because an expired-but-not-yet-ended row is logically dead and
    // would still block the index.
    await tx
      .update(impersonationSession)
      .set({ endedAt: now, endedReason: "superseded" })
      .where(
        and(
          eq(impersonationSession.adminId, req.admin!.id),
          isNull(impersonationSession.endedAt),
        ),
      );

    const [created] = await tx
      .insert(impersonationSession)
      .values({
        adminId: req.admin!.id,
        adminUserId: req.admin!.userId,
        targetOwnerId: ownerId,
        reason: parsed.data.reason,
        mode: "read_only",
        handoffTokenHash: hashToken(handoffToken),
        handoffExpiresAt: new Date(now.getTime() + HANDOFF_TTL_MS),
        // Set on claim; a handoff that is never followed simply expires.
        expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS),
        absoluteExpiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS),
      })
      .returning();
    if (!created) throw new Error("Failed to create impersonation session");

    await tx.insert(adminAuditLog).values({
      adminId: req.admin!.id,
      adminUserId: req.admin!.userId,
      adminEmail: req.user!.email,
      impersonationSessionId: created.id,
      action: "impersonation.start",
      entityType: "owner",
      entityId: ownerId,
      ownerId,
      method: req.method,
      path: req.path,
      statusCode: 201,
      reason: parsed.data.reason,
      ipAddress: clientIp(req),
      userAgent: userAgent(req),
      requestId: (req.headers["x-request-id"] as string) ?? null,
    });

    return created;
  });

  res.status(201).json({
    sessionId: session.id,
    ownerName: owner.ownerName ?? "Unknown",
    redirectUrl: `${ownerAppUrl()}/impersonate/start?token=${encodeURIComponent(handoffToken)}`,
  });
});

/** Own sessions; a super_admin sees everyone's. */
router.get("/impersonation/sessions", async (req: AuthenticatedRequest, res) => {
  const mine = eq(impersonationSession.adminId, req.admin!.id);
  const rows = await db
    .select({
      id: impersonationSession.id,
      adminUserId: impersonationSession.adminUserId,
      adminName: user.name,
      targetOwnerId: impersonationSession.targetOwnerId,
      reason: impersonationSession.reason,
      mode: impersonationSession.mode,
      startedAt: impersonationSession.startedAt,
      expiresAt: impersonationSession.expiresAt,
      endedAt: impersonationSession.endedAt,
      endedReason: impersonationSession.endedReason,
    })
    .from(impersonationSession)
    .leftJoin(user, eq(impersonationSession.adminUserId, user.id))
    .where(req.admin!.role === "super_admin" ? undefined : mine)
    .orderBy(desc(impersonationSession.startedAt))
    .limit(100);
  res.json(rows);
});

/** Force-end. `support` may only end its own sessions. */
router.post("/impersonation/sessions/:sessionId/end", async (req: AuthenticatedRequest, res) => {
  const sessionId = param(req, "sessionId");
  const scope =
    req.admin!.role === "super_admin"
      ? eq(impersonationSession.id, sessionId)
      : and(eq(impersonationSession.id, sessionId), eq(impersonationSession.adminId, req.admin!.id));

  const [ended] = await db
    .update(impersonationSession)
    .set({ endedAt: new Date(), endedReason: "revoked" })
    .where(and(scope, isNull(impersonationSession.endedAt)))
    .returning({ id: impersonationSession.id });

  if (!ended) return res.status(404).json({ error: "No live session with that id" });
  res.json({ ok: true });
});

/** Panic button: end all of my live sessions at once. */
router.post("/impersonation/end-all", async (req: AuthenticatedRequest, res) => {
  const ended = await db
    .update(impersonationSession)
    .set({ endedAt: new Date(), endedReason: "revoked" })
    .where(and(eq(impersonationSession.adminId, req.admin!.id), isNull(impersonationSession.endedAt)))
    .returning({ id: impersonationSession.id });
  res.json({ ended: ended.length });
});

export default router;
