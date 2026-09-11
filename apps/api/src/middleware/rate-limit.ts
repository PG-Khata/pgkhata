import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";

/**
 * Per-admin rate limiting for /v1/admin.
 *
 * WHY NOT BY IP. The admin console never talks to this API directly: it calls
 * its own origin and a Next rewrite proxies /api/backend/* onwards (see
 * apps/admin/next.config.ts). By the time Express sees the request the socket
 * belongs to the Next server, so `req.ip` is one address for every admin on the
 * platform. An IP limiter would therefore be a single shared bucket — the first
 * admin to run a report would 429 everybody else, and a compromised session
 * would be indistinguishable from normal traffic because it is already pooled
 * with it. The key is `req.user.id`, which survives the proxy because it comes
 * from the session cookie the proxy forwards.
 *
 * Better Auth's own limiter (packages/auth/src/auth.ts) is DB-backed but only
 * covers /api/auth/*, so it protects the login endpoints and nothing else.
 */

export interface RateLimitRule {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per key per window. */
  max: number;
}

export interface RateLimitRules {
  /** Safe methods: list pages, detail pages, the polling the console does. */
  read: RateLimitRule;
  /** Anything that writes. Deliberately small: these are human-paced actions. */
  mutation: RateLimitRule;
  /** Cross-owner scans — global search, analytics, exports. */
  expensive: RateLimitRule;
}

export type RateLimitTier = keyof RateLimitRules;

/**
 * Endpoints that scan across every owner rather than one row, matched with or
 * without the /v1/admin mount prefix so the classifier does not depend on
 * whether Express has stripped it.
 */
const EXPENSIVE_PATH = /^(?:\/v1\/admin)?\/(?:search|analytics|metrics|exports?)(?:\/|$)/;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function classifyRequest(method: string, path: string): RateLimitTier {
  if (EXPENSIVE_PATH.test(path)) return "expensive";
  return MUTATING_METHODS.has(method.toUpperCase()) ? "mutation" : "read";
}

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds at which the current window rolls over. */
  resetAt: number;
}

/**
 * Fixed-window counters held in this process.
 *
 * Sized for the admin surface: keys are `tier:userId`, so the map holds at most
 * three entries per platform admin and there are tens of those, not millions.
 * Expired windows are swept on write rather than on a timer — an interval would
 * hold the event loop open and has to be reasoned about in the graceful
 * shutdown path.
 */
export class FixedWindowStore {
  private windows = new Map<string, Window>();
  private lastSweep = 0;

  /** How often the whole map is walked to drop expired windows. */
  private static readonly SWEEP_INTERVAL_MS = 60_000;

  hit(key: string, rule: RateLimitRule, now: number): RateLimitDecision {
    this.sweep(now);

    const existing = this.windows.get(key);
    const current =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + rule.windowMs };

    if (current.count >= rule.max) {
      // Not incremented on rejection: counting blocked attempts would let a
      // client that keeps hammering push its own window's count arbitrarily
      // high without changing when it reopens, which only wastes memory.
      this.windows.set(key, current);
      return { allowed: false, limit: rule.max, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    this.windows.set(key, current);
    return {
      allowed: true,
      limit: rule.max,
      remaining: rule.max - current.count,
      resetAt: current.resetAt,
    };
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < FixedWindowStore.SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }

  /** Test seam: forget every counter. */
  reset(): void {
    this.windows.clear();
    this.lastSweep = 0;
  }
}

export interface RateLimiterOptions {
  rules: RateLimitRules;
  /** Injectable clock so tests can cross a window boundary without waiting. */
  now?: () => number;
  store?: FixedWindowStore;
}

export interface RateLimiter {
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void;
  store: FixedWindowStore;
}

export function createRateLimiter({
  rules,
  now = Date.now,
  store = new FixedWindowStore(),
}: RateLimiterOptions): RateLimiter {
  function rateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const userId = req.user?.id;

    // No identity means `requireAuth` has not run or has already answered 401,
    // so there is nothing to meter and nobody to meter it against. Falling back
    // to `req.ip` here would reintroduce exactly the shared bucket this module
    // exists to avoid.
    if (!userId) return next();

    const tier = classifyRequest(req.method, req.path);
    const decision = store.hit(`${tier}:${userId}`, rules[tier], now());

    res.setHeader("RateLimit-Limit", decision.limit);
    res.setHeader("RateLimit-Remaining", decision.remaining);
    res.setHeader("RateLimit-Reset", Math.ceil((decision.resetAt - now()) / 1000));

    if (decision.allowed) return next();

    const retryAfter = Math.max(1, Math.ceil((decision.resetAt - now()) / 1000));
    res.setHeader("Retry-After", retryAfter);
    res.status(429).json({
      error: "Too many requests",
      // Named so the console can tell "you are clicking too fast" apart from
      // "this report is throttled", which have different advice.
      scope: tier,
      retryAfterSeconds: retryAfter,
      requestId: req.headers["x-request-id"],
    });
  }

  // Named for admin-route-guards.test.ts, which reads the mounted stack by
  // handler name.
  Object.defineProperty(rateLimit, "name", { value: "adminRateLimit" });

  return Object.assign(rateLimit, { store });
}

const MINUTE = 60_000;

/**
 * Budgets, per admin per minute.
 *
 * Reads are generous because the console fans out several list calls per screen
 * and support agents legitimately click fast; 600/min is roughly ten requests a
 * second sustained, which no human drives but a scripted dump does. Mutations
 * are 30/min because every write on this surface is a deliberate human action
 * (suspend an owner, publish a post, recompute a bill) and nobody performs one
 * every two seconds. The expensive tier covers queries that touch every owner's
 * data at once, which is both the slowest thing the API does and the shape a
 * bulk exfiltration takes.
 *
 * Inflated under NODE_ENV=test so the integration suites, which drive hundreds
 * of requests as a single admin in seconds, are not metered — the same escape
 * hatch Better Auth's limiter uses in packages/auth/src/auth.ts.
 */
const isTest = process.env.NODE_ENV === "test";

export const ADMIN_RATE_LIMITS: RateLimitRules = {
  read: { windowMs: MINUTE, max: isTest ? 1_000_000 : 600 },
  mutation: { windowMs: MINUTE, max: isTest ? 1_000_000 : 30 },
  expensive: { windowMs: MINUTE, max: isTest ? 1_000_000 : 10 },
};

/** The instance mounted in src/index.ts. */
export const adminRateLimit = createRateLimiter({ rules: ADMIN_RATE_LIMITS });
