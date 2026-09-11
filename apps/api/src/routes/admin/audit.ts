import { Router } from "express";
import { z } from "zod";
import { db, adminAuditLog } from "@pgkhata/db";
import { eq, desc, and, like, gte, lte, type SQL } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { param } from "../../lib/http";
import { pagination, sendPage } from "../../lib/pagination";

/**
 * Read side of `admin_audit_log`. The table has an append-only trigger, so
 * there is deliberately no write route here — not even for the rows this
 * surface produces itself.
 *
 * Everything is super_admin: the log carries every admin's actions plus the
 * before/after images of rows across every owner on the platform, which is a
 * strictly wider view than any single admin's own work.
 */

const router = Router();

// Applied per route, deliberately NOT via `router.use(requireSuperAdminRole)`.
// Every admin sub-router is mounted at "/", so a router-level `use` runs for
// EVERY request that reaches this file — including ones a sibling router
// mounted later will actually handle. That made `support` admins get 403 from
// POST /owners/:id/impersonate, i.e. the core support action, despite that
// route being deliberately open to them.

const auditQuerySchema = z.object({
  ownerId: z.string().uuid().optional(),
  adminUserId: z.string().trim().min(1).max(200).optional(),
  action: z.string().trim().min(1).max(200).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * `action` is a prefix filter ("admin.delete" matches every delete), so the
 * value reaches a LIKE pattern. Left unescaped, an underscore in a caller's
 * filter silently becomes a single-character wildcard and `%` matches
 * everything — quietly wrong answers in the one tool you consult when you do
 * not trust the data.
 */
function likePrefix(value: string): string {
  return `${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * The list deliberately omits `before` and `after`. Those are whole rows —
 * large, and carrying the personal data of tenants who are not the subject of
 * the search. Drill into a single entry when you actually need the diff.
 */
const listColumns = {
  id: adminAuditLog.id,
  createdAt: adminAuditLog.createdAt,
  action: adminAuditLog.action,
  adminEmail: adminAuditLog.adminEmail,
  adminUserId: adminAuditLog.adminUserId,
  ownerId: adminAuditLog.ownerId,
  entityType: adminAuditLog.entityType,
  entityId: adminAuditLog.entityId,
  method: adminAuditLog.method,
  path: adminAuditLog.path,
  statusCode: adminAuditLog.statusCode,
  reason: adminAuditLog.reason,
  impersonationSessionId: adminAuditLog.impersonationSessionId,
  ipAddress: adminAuditLog.ipAddress,
};

router.get("/audit", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const parsed = auditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const filters = parsed.data;

  const where: SQL[] = [];
  if (filters.ownerId) where.push(eq(adminAuditLog.ownerId, filters.ownerId));
  if (filters.adminUserId) where.push(eq(adminAuditLog.adminUserId, filters.adminUserId));
  if (filters.action) where.push(like(adminAuditLog.action, likePrefix(filters.action)));
  if (filters.entityType) where.push(eq(adminAuditLog.entityType, filters.entityType));
  if (filters.from) where.push(gte(adminAuditLog.createdAt, filters.from));
  if (filters.to) where.push(lte(adminAuditLog.createdAt, filters.to));

  const page = pagination(req);
  const rows = await db
    .select(listColumns)
    .from(adminAuditLog)
    .where(where.length ? and(...where) : undefined)
    // Newest first: an investigation starts from "what just happened".
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(page.limit)
    .offset(page.offset);

  return sendPage(res, rows, page);
});

/** Drill-down: the only place `before`/`after` are served. */
router.get("/audit/:auditId", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const auditId = param(req, "auditId");
  const [row] = await db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.id, auditId))
    .limit(1);

  if (!row) return res.status(404).json({ error: "Audit entry not found" });
  res.json(row);
});

export default router;
