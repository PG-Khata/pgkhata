import { Request, Response, NextFunction } from "express";
import { auth } from "@pgkhata/auth";
import { db, ownerProfile, property } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import type { AdminContext } from "./admin";
import type { ImpersonationContext } from "./impersonation";
import { IMPERSONATION_COOKIE } from "../lib/impersonation";
import { clearSecureCookie } from "../lib/cookies";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  ownerId?: string;
  /** Set by `requireProperty`; already proven to belong to `ownerId`. */
  propertyId?: string;
  property?: typeof property.$inferSelect;
  /** Set by `requireAdmin`. Absent on owner routes. */
  admin?: AdminContext;
  /** Set by the global `resolveImpersonation`. Absent on ordinary requests. */
  impersonation?: ImpersonationContext;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (session) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      };

      // A real login on this origin outranks a grant cookie. We never create
      // this state ourselves — the grant is only ever set on the owner origin,
      // where the admin has no session — so it means a stale or replayed cookie
      // sitting in a genuine owner's browser. Drop it rather than let it
      // re-scope somebody's own session.
      if (req.impersonation && req.impersonation.targetUserId !== session.user.id) {
        req.impersonation = undefined;
        clearSecureCookie(res, IMPERSONATION_COOKIE);
      }
      return next();
    }

    // No session on this origin. An active grant is itself the credential: it
    // was minted for an authenticated, active platform admin, is bound to one
    // owner, and expires in minutes. `req.user` becomes the *owner's* identity
    // so handlers and the owner UI see the account being operated on; who the
    // human actually was lives in req.impersonation and in admin_audit_log.
    if (req.impersonation) {
      req.user = {
        id: req.impersonation.targetUserId,
        email: req.impersonation.targetUserEmail,
        name: req.impersonation.targetUserName,
      };
      return next();
    }

    return res.status(401).json({ error: "Unauthorized" });
  } catch (error) {
    res.status(503).json({ error: "Authentication service temporarily unavailable" });
  }
}

export async function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Tenancy is decided exactly here for every owner route in the app, which
    // is why this is the only place impersonation has to change scope.
    // `requireProperty` and every handler downstream keep comparing against
    // req.ownerId and need no knowledge of impersonation at all.
    if (req.impersonation) {
      req.ownerId = req.impersonation.targetOwnerId;
      return next();
    }

    const [profile] = await db
      .select()
      .from(ownerProfile)
      .where(eq(ownerProfile.userId, req.user.id))
      .limit(1);

    if (!profile) {
      return res.status(403).json({ error: "Owner profile not found" });
    }

    req.ownerId = profile.id;
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
