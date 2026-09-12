import type { Request, Response, NextFunction } from "express";
import { FixedWindowStore, type RateLimitRule } from "./rate-limit";

/**
 * IP + token rate limiting for the unauthenticated public capability routes
 * (tenant self-signup, complaint submission).
 *
 * These routes take a capability token in the URL and no session, so neither
 * `requireOwner` nor the user-keyed admin limiter can see them. Left open, a
 * leaked or QR-embedded signup token lets anyone spam tenant rows and 10 MB
 * document uploads (driving storage cost / DoS), and the duplicate-phone check
 * is trivially sidestepped with fresh numbers.
 *
 * Keyed by `token:ip` together: one abusive IP cannot burn a legitimate token
 * for everyone, and a single token cannot be hammered from one client. This is
 * an in-process fixed window — correct for a single API instance; a shared
 * store (Redis/DB) would be the next step if the API scales horizontally.
 */
export function createPublicWriteLimiter(
  rule: RateLimitRule,
  store: FixedWindowStore = new FixedWindowStore(),
) {
  function publicWriteLimit(req: Request, res: Response, next: NextFunction) {
    const token = req.params.token ?? "no-token";
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const decision = store.hit(`public:${token}:${ip}`, rule, now);

    res.setHeader("RateLimit-Limit", decision.limit);
    res.setHeader("RateLimit-Remaining", decision.remaining);

    if (decision.allowed) return next();

    const retryAfter = Math.max(1, Math.ceil((decision.resetAt - now) / 1000));
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json({
      error: "Too many requests",
      retryAfterSeconds: retryAfter,
      requestId: req.headers["x-request-id"],
    });
  }

  return Object.assign(publicWriteLimit, { store });
}

const isTest = process.env.NODE_ENV === "test";
const MINUTE = 60_000;

/**
 * Inflated under NODE_ENV=test so integration suites that drive several submits
 * against one token are not metered, the same escape hatch the admin limiter and
 * Better Auth use.
 */
export const publicSignupLimiter = createPublicWriteLimiter({
  windowMs: 15 * MINUTE,
  max: isTest ? 1_000_000 : 10,
});

export const publicComplaintLimiter = createPublicWriteLimiter({
  windowMs: 15 * MINUTE,
  max: isTest ? 1_000_000 : 20,
});
