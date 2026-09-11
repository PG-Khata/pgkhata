import type { Response, NextFunction } from "express";
import { db, adminAuditLog } from "@pgkhata/db";
import type { AuthenticatedRequest } from "./auth";
import { clientIp, userAgent } from "../lib/impersonation";
import { entityFrom, normalisePath, readBefore, redact } from "../lib/audit";
import { logger } from "../lib/logger";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Records every privileged write without touching a single handler.
 *
 * Editing each admin handler would be a large diff *and* a permanent
 * maintenance tax — the next handler someone adds will forget. Intercepting
 * here also covers routes that do not exist yet.
 *
 * Only admin and impersonated requests are recorded. Auditing ordinary owner
 * writes would be orders of magnitude more volume and a different feature.
 */
export function auditPrivilegedWrites(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method)) return next();

  // Capture the body on its way out, but write the row on "finish".
  //
  // Wrapping res.json alone missed every response that does not send JSON —
  // notably `DELETE /v1/admin/admins/:id`, which answers 204 via res.end(), so
  // removing a platform admin escaped the log entirely. "finish" fires exactly
  // once for every response however it was sent, including errors and empty
  // bodies, which is the property an audit trail actually needs.
  //
  // The path must be captured now, not in the finish handler. Express rewrites
  // req.url when it routes into a mounted sub-router, so by the time "finish"
  // fires, req.path has been reduced to the router-relative tail — `/owners/:id`
  // rather than `/v1/admin/owners/:id`, and a bare `/` for single-path mounts.
  // originalUrl is never rewritten, so the log records the path actually hit.
  const fullPath = req.originalUrl.split("?")[0] ?? req.path;

  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    // req.admin / req.impersonation are populated by the time the response is
    // sent, which is why this reads them here rather than up front.
    const impersonation = req.impersonation;
    const actor = req.admin ?? impersonation;
    if (!actor) return;

    const { entityType, entityId } = entityFrom(fullPath);
    const row = {
      adminId: req.admin?.id ?? impersonation?.adminId ?? null,
      adminUserId: req.admin?.userId ?? impersonation!.adminUserId,
      adminEmail: req.admin ? req.user!.email : impersonation!.adminEmail,
      impersonationSessionId: impersonation?.sessionId ?? null,
      action: `${impersonation ? "impersonated" : "admin"}.${req.method.toLowerCase()}${normalisePath(fullPath)}`,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      ownerId: impersonation?.targetOwnerId ?? req.ownerId ?? null,
      method: req.method,
      path: fullPath,
      statusCode: res.statusCode,
      before: redact(readBefore(req)),
      after: redact(responseBody ?? null),
      // The justification that authorised this specific write.
      reason: impersonation?.writeReason ?? impersonation?.reason ?? null,
      ipAddress: clientIp(req),
      userAgent: userAgent(req),
      requestId: (req.headers["x-request-id"] as string) ?? null,
    };

    // Not awaited: an audit outage must not turn into a customer-facing
    // outage. It must, however, be loud — alert on this log line.
    void db
      .insert(adminAuditLog)
      .values(row)
      .catch((error) =>
        logger.error(
          { err: error, requestId: row.requestId, action: row.action },
          "AUDIT WRITE FAILED",
        ),
      );
  });

  next();
}
