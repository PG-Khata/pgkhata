import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";

export const IMPERSONATION_COOKIE = "pgk_imp";

/** One redirect hop. */
export const HANDOFF_TTL_MS = 60_000;
/** A support call is 10-20 minutes; a stolen laptop should not be a workday. */
export const SESSION_TTL_MS = 30 * 60_000;
/** Hard ceiling on renewals, so "extend" cannot become "forever". */
export const SESSION_ABSOLUTE_TTL_MS = 2 * 60 * 60_000;
/** Long enough to fix a bill; short enough that a forgotten tab is read-only. */
export const WRITE_WINDOW_MS = 15 * 60_000;

/** Minimum length of the free-text justification for a session or escalation. */
export const MIN_REASON_LENGTH = 15;

/**
 * 256 bits from the CSPRNG. The value asserts nothing on its own — every
 * attribute of the grant is read from the row — so it needs no signature, and
 * revoking it is an UPDATE rather than a key rotation.
 */
export function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Stored hashed so a database dump is not a bag of live credentials. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * `app.set("trust proxy")` is not configured, so `req.ip` is the Vercel or
 * Render hop. Mirrors the header order better-auth is configured with in
 * packages/auth/src/auth.ts.
 */
export function clientIp(req: Request): string | null {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
}

export function userAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 512) : null;
}

/** Where the owner app lives, for the post-start redirect. */
export function ownerAppUrl(): string {
  return (process.env.APP_URL || process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:3000").trim();
}

/** Where the admin console lives, for the post-exit return link. */
export function adminAppUrl(): string {
  return (process.env.ADMIN_URL || "http://localhost:3002").trim();
}
