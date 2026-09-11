import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../index";
import impersonationRouter from "../routes/impersonation";
import { enforceImpersonationReadOnly } from "../middleware/impersonation";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { Response } from "express";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

/**
 * The read-only guarantee is enforced by one global middleware rather than by
 * each of the ~28 owner routers, so these tests exercise that middleware
 * directly. A DB-backed end-to-end run lives in the integration suite; what
 * matters here is that the decision table itself cannot drift.
 */

interface FakeResult {
  status?: number;
  body?: unknown;
  nextCalled: boolean;
}

function runReadOnlyGuard(
  method: string,
  path: string,
  impersonation: Partial<AuthenticatedRequest["impersonation"]> | undefined,
): FakeResult {
  const result: FakeResult = { nextCalled: false };
  const req = { method, path, headers: {}, impersonation } as unknown as AuthenticatedRequest;
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;

  enforceImpersonationReadOnly(req, res, () => {
    result.nextCalled = true;
  });
  return result;
}

const READ_ONLY = { canWrite: false } as AuthenticatedRequest["impersonation"];
const WRITE_MODE = { canWrite: true } as AuthenticatedRequest["impersonation"];

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

describe("impersonation read-only enforcement", () => {
  it.each(WRITE_METHODS)("%s is blocked on a read-only session", (method) => {
    const result = runReadOnlyGuard(method, "/v1/properties/abc/bills", READ_ONLY);
    expect(result.nextCalled).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ code: "IMPERSONATION_READ_ONLY" });
  });

  it.each(SAFE_METHODS)("%s is always allowed on a read-only session", (method) => {
    const result = runReadOnlyGuard(method, "/v1/properties/abc/bills", READ_ONLY);
    expect(result.nextCalled).toBe(true);
  });

  it.each(WRITE_METHODS)("%s is allowed once write access is granted", (method) => {
    const result = runReadOnlyGuard(method, "/v1/properties/abc/bills", WRITE_MODE);
    expect(result.nextCalled).toBe(true);
  });

  it.each(WRITE_METHODS)("%s is untouched for a request with no grant", (method) => {
    const result = runReadOnlyGuard(method, "/v1/properties/abc/bills", undefined);
    expect(result.nextCalled).toBe(true);
  });

  it("allows the escalate/exit controls through while read-only", () => {
    // These are how you leave or ask for write access; blocking them would trap
    // the session in a state it cannot get out of.
    for (const path of ["/v1/impersonation/escalate", "/v1/impersonation/exit"]) {
      expect(runReadOnlyGuard("POST", path, READ_ONLY).nextCalled).toBe(true);
    }
  });

  it("does not allowlist paths that merely start with the same prefix", () => {
    // /v1/impersonationfoo must not inherit the control-router exemption.
    const result = runReadOnlyGuard("POST", "/v1/impersonationfoo", READ_ONLY);
    expect(result.nextCalled).toBe(false);
    expect(result.status).toBe(403);
  });
});

describe("impersonation control router", () => {
  interface Layer {
    route?: { path: string; methods: Record<string, boolean> };
  }

  const paths = (impersonationRouter as unknown as { stack: Layer[] }).stack
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route!.methods)[0]!.toUpperCase()} ${l.route!.path}`)
    .sort();

  it("exposes only session-lifecycle endpoints", () => {
    // This router is an allowlist hole in the read-only guarantee: while a
    // session is read-only, its non-GET routes still run. Anything added here
    // that touches owner data would silently become writable.
    expect(paths).toEqual([
      "GET /history",
      "GET /status",
      "POST /claim",
      "POST /escalate",
      "POST /exit",
      "POST /extend",
    ]);
  });
});

describe("impersonation endpoints reject anonymous callers", () => {
  it.each([
    ["/v1/impersonation/escalate"],
    ["/v1/impersonation/extend"],
    ["/v1/impersonation/exit"],
    ["/v1/impersonation/history"],
  ])("POST/GET %s requires a session or grant", async (path) => {
    const res = await request(app).get(path);
    // No session and no grant: requireAuth answers 401 before any handler runs.
    expect([401, 404]).toContain(res.status);
  });

  it("POST /v1/impersonation/claim rejects a missing token", async () => {
    const res = await request(app).post("/v1/impersonation/claim").send({});
    expect(res.status).toBe(400);
  });

  // Needs a database: the claim is a single-use compare-and-swap, so rejecting
  // an unknown token is a query result rather than a validation branch.
  describeDb("with a database", () => {
    it("POST /v1/impersonation/claim rejects an unknown token", async () => {
      const res = await request(app)
        .post("/v1/impersonation/claim")
        .send({ token: "not-a-real-handoff-token" });
      expect(res.status).toBe(401);
    });
  });
});

describe("audit interceptor covers every response shape", () => {
  /**
   * The interceptor originally wrapped only `res.json`, so any handler that
   * answered without a JSON body escaped the log entirely — including
   * `DELETE /v1/admin/admins/:id`, which returns 204 via `res.end()`. Removing
   * a platform admin is exactly the kind of privilege change the log exists
   * for, so this asserts the hook is on "finish" rather than on `res.json`.
   */
  const source = readFileSync(new URL("../middleware/audit.ts", import.meta.url), "utf8");

  it("records on response finish, not on res.json", () => {
    expect(source).toContain('res.on("finish"');
    // The insert must not sit inside the res.json wrapper, or 204s are missed.
    const jsonWrapper = source.slice(
      source.indexOf("res.json = "),
      source.indexOf('res.on("finish"'),
    );
    expect(jsonWrapper).not.toContain("adminAuditLog");
  });

  /**
   * Express rewrites req.url when routing into a mounted sub-router, so reading
   * req.path from the deferred finish handler recorded `/owners/:id` instead of
   * `/v1/admin/owners/:id` — and a bare `/` for single-path mounts like
   * /v1/profile. The audit trail is the only record of an impersonated write,
   * so a truncated path is a real loss.
   */
  it("records the caller's full path, not the router-relative tail", () => {
    const finishHandler = source.slice(source.indexOf('res.on("finish"'));
    expect(finishHandler).not.toContain("req.path");
    expect(source).toContain("req.originalUrl");
  });
});

describe("CORS accepts every configured origin", () => {
  /**
   * CORS_ORIGIN carries all allowed origins comma-separated, because that is
   * how better-auth reads it for trustedOrigins. Passing the raw string to the
   * `cors` package makes it an exact match against the Origin header, so adding
   * the admin console silently broke the owner app instead of failing loudly.
   */
  const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

  it("splits CORS_ORIGIN rather than matching the joined string", () => {
    const corsCall = source.slice(source.indexOf("cors({"), source.indexOf("express.json"));
    expect(corsCall).toContain('.split(",")');
    expect(corsCall).not.toMatch(/origin:\s*process\.env\.CORS_ORIGIN\s*,/);
  });

  it("stays in step with better-auth's own parsing", () => {
    const policy = readFileSync(
      new URL("../../../../packages/auth/src/security-policy.ts", import.meta.url),
      "utf8",
    );
    // Both consumers must agree on the separator, or one will trust an origin
    // the other rejects.
    expect(policy).toContain('.split(",")');
  });
});
