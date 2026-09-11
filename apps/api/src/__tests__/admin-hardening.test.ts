import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { NextFunction, Response } from "express";
import { maskIdNumber, scrubPii } from "../lib/pii";
import { classifyRequest, createRateLimiter } from "../middleware/rate-limit";
import type { AuthenticatedRequest } from "../middleware/auth";

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

describe("maskIdNumber", () => {
  it("keeps only the last four digits of an Aadhaar", () => {
    expect(maskIdNumber("123456789012")).toBe("XXXXXXXX9012");
  });

  it("keeps only the last four characters of a PAN", () => {
    expect(maskIdNumber("ABCDE1234F")).toBe("XXXXXX234F");
  });

  it("leaves an absent identifier absent", () => {
    // A tenant with no Aadhaar on file must not come back looking like one who
    // has one, or support chases a record that does not exist.
    expect(maskIdNumber(null)).toBeNull();
    expect(maskIdNumber(undefined)).toBeNull();
    expect(maskIdNumber("")).toBeNull();
    expect(maskIdNumber("   ")).toBeNull();
  });

  it("reveals nothing at all from a value too short to mask meaningfully", () => {
    // Last-four of a five character value is the value. Anything below the
    // length of a real identifier is malformed data whose shape we cannot
    // reason about, so none of it is shown.
    for (const short of ["1", "12", "1234", "12345", "1234567"]) {
      const masked = maskIdNumber(short);
      expect(masked).toBe("X".repeat(short.length));
      expect(masked).not.toContain(short.slice(-1));
    }
  });

  it("reveals no more than four characters however long or odd the input", () => {
    const inputs = [
      "1234 5678 9012", // spaced, as operators often type Aadhaar
      "12345678",
      "aadhaar:123456789012",
      "0".repeat(200) + "abcd",
    ];
    for (const input of inputs) {
      const masked = maskIdNumber(input)!;
      const revealed = masked.replace(/^X+/, "");
      expect(revealed.length).toBeLessThanOrEqual(4);
      expect(masked).toHaveLength(input.trim().length);
    }
  });

  it("never returns a value that still contains the original in full", () => {
    const aadhaar = "987612345678";
    expect(maskIdNumber(aadhaar)).not.toContain(aadhaar);
    expect(maskIdNumber(aadhaar)).not.toContain(aadhaar.slice(0, 5));
  });
});

describe("scrubPii", () => {
  it("masks the identifiers on a tenant row and touches nothing else", () => {
    const row = {
      id: "t1",
      name: "Asha",
      phone: "9876543210",
      aadhaarNumber: "123456789012",
      panNumber: "ABCDE1234F",
    };

    expect(scrubPii(row)).toEqual({
      id: "t1",
      name: "Asha",
      // Phone is not a government identifier and support dials it; it stays.
      phone: "9876543210",
      aadhaarNumber: "XXXXXXXX9012",
      panNumber: "XXXXXX234F",
    });
  });

  it("does not mutate the row it was given", () => {
    const row = { aadhaarNumber: "123456789012" };
    scrubPii(row);
    expect(row.aadhaarNumber).toBe("123456789012");
  });

  it("reaches identifiers nested in arrays and sub-objects", () => {
    const payload = {
      tenants: [{ aadhaarNumber: "123456789012" }, { aadhaarNumber: null }],
      meta: { primary: { panNumber: "ABCDE1234F" } },
    };

    const scrubbed = scrubPii(payload);
    expect(scrubbed.tenants[0]!.aadhaarNumber).toBe("XXXXXXXX9012");
    expect(scrubbed.tenants[1]!.aadhaarNumber).toBeNull();
    expect(scrubbed.meta.primary.panNumber).toBe("XXXXXX234F");
  });

  it("leaves dates as Date instances", () => {
    // Rebuilding an object from Object.entries turns a Date into {}, which
    // would silently break every createdAt in a scrubbed payload.
    const at = new Date("2026-01-01T00:00:00.000Z");
    const scrubbed = scrubPii({ createdAt: at, bills: [{ dueDate: at }] });
    expect(scrubbed.createdAt).toBeInstanceOf(Date);
    expect(scrubbed.bills[0]!.dueDate).toBeInstanceOf(Date);
    expect(scrubbed.createdAt.toISOString()).toBe(at.toISOString());
  });

  it("passes primitives, null and empty structures through unchanged", () => {
    expect(scrubPii(null)).toBeNull();
    expect(scrubPii(undefined)).toBeUndefined();
    expect(scrubPii(7)).toBe(7);
    expect(scrubPii("plain")).toBe("plain");
    expect(scrubPii([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The admin tenant router must not be able to serve a raw identifier
// ---------------------------------------------------------------------------

const TENANTS_SOURCE = readFileSync(
  resolve(import.meta.dirname, "../routes/admin/tenants.ts"),
  "utf8",
);

/**
 * Source-level, deliberately. The behavioural version of this needs a database,
 * and it only covers the three routes that exist today. This one keeps holding
 * when somebody adds a fourth next month, which is the failure mode that
 * actually leaks: nobody sets out to expose an Aadhaar, they just write a new
 * handler the way the old ones used to be written.
 */
describe("routes/admin/tenants.ts never serves a raw Aadhaar or PAN", () => {
  it("never selects a whole tenant row", () => {
    // `select()` with no argument returns every column of `tenant`, which means
    // a column added to the schema starts being served by this API the moment
    // it is created, with nobody reviewing the decision.
    expect(TENANTS_SOURCE).not.toMatch(/\.select\(\)\s*\n?\s*\.from\(tenant\)/);
  });

  it("keeps the identifiers out of the paginated list's column set", () => {
    // Masked or not, identifiers do not belong on a route that returns up to a
    // full page of tenants at a time.
    const listColumns = TENANTS_SOURCE.slice(
      TENANTS_SOURCE.indexOf("const tenantColumns"),
      TENANTS_SOURCE.indexOf("const tenantFilterSchema"),
    );
    const spreadIntoList = listColumns.slice(0, listColumns.indexOf("tenantIdentityColumns"));
    expect(spreadIntoList).not.toContain("tenant.aadhaarNumber");
    expect(spreadIntoList).not.toContain("tenant.panNumber");
  });

  it("sends every response body through scrubPii", () => {
    const calls = [
      ...TENANTS_SOURCE.matchAll(
        /res(?:\.status\(\d+\))?\.json\(|sendPage(?:WithTotal)?\(\s*res,\s*/g,
      ),
    ];

    // If the regex ever stops matching, this suite would pass while asserting
    // nothing at all.
    expect(calls.length).toBeGreaterThanOrEqual(5);

    for (const call of calls) {
      const argument = TENANTS_SOURCE.slice(call.index + call[0].length).trimStart();
      const scrubbed = argument.startsWith("scrubPii(");
      // A bare error body carries no tenant data and needs no scrubbing.
      const errorOnly = /^\{\s*error:/.test(argument);
      expect(
        scrubbed || errorOnly,
        `response body is neither scrubbed nor an error: ${argument.slice(0, 60)}`,
      ).toBe(true);
    }
  });

  it("exposes no route that reveals a full identifier", () => {
    // The masked value is the product. A "reveal" endpoint would put the whole
    // corpus one compromised admin session away again.
    const routePaths = [...TENANTS_SOURCE.matchAll(/router\.\w+\(\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(routePaths.length).toBeGreaterThan(0);
    for (const path of routePaths) {
      expect(path.toLowerCase()).not.toMatch(/aadhaar|pan|reveal|unmask|kyc/);
    }
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

function makeReq(
  userId: string | undefined,
  { method = "GET", path = "/tenants", ip = "10.0.0.7" } = {},
): AuthenticatedRequest {
  return {
    method,
    path,
    ip,
    headers: { "x-request-id": "req-1" },
    user: userId ? { id: userId, email: `${userId}@pgkhata.test`, name: userId } : undefined,
  } as unknown as AuthenticatedRequest;
}

interface FakeResponse {
  statusCode: number | null;
  body: unknown;
  headers: Record<string, unknown>;
}

function makeRes(): Response & FakeResponse {
  const res = {
    statusCode: null as number | null,
    body: undefined as unknown,
    headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) {
      res.headers[key] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as unknown as Response & FakeResponse;
}

/** Drives one request through the limiter and reports whether it got through. */
function send(
  limiter: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void,
  req: AuthenticatedRequest,
) {
  const res = makeRes();
  let passed = false;
  limiter(req, res, () => {
    passed = true;
  });
  return { passed, res };
}

const rules = {
  read: { windowMs: 60_000, max: 3 },
  mutation: { windowMs: 60_000, max: 2 },
  expensive: { windowMs: 60_000, max: 1 },
};

describe("admin rate limiter", () => {
  it("trips once the budget for the window is spent", () => {
    const limiter = createRateLimiter({ rules });
    const req = makeReq("admin-1");

    expect(send(limiter, req).passed).toBe(true);
    expect(send(limiter, req).passed).toBe(true);
    expect(send(limiter, req).passed).toBe(true);

    const blocked = send(limiter, req);
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.body).toMatchObject({ error: "Too many requests", scope: "read" });
    expect(Number(blocked.res.headers["Retry-After"])).toBeGreaterThan(0);
  });

  it("buckets by user id, not by IP", () => {
    /**
     * The whole point. The admin console reaches this API through the Next
     * rewrite in apps/admin/next.config.ts, so every admin arrives from the
     * same socket address. An IP-keyed limiter would give the entire platform
     * support team one shared budget: the first agent to run a few lists would
     * lock out everyone else, and the throttle would fire hardest exactly when
     * the team is busiest. Same IP, different users, independent budgets.
     */
    const limiter = createRateLimiter({ rules });
    const ip = "10.0.0.7";
    const first = makeReq("admin-1", { ip });
    const second = makeReq("admin-2", { ip });

    expect(first.ip).toBe(second.ip);

    // Exhaust the first admin completely.
    for (let i = 0; i < rules.read.max; i += 1) {
      expect(send(limiter, first).passed).toBe(true);
    }
    expect(send(limiter, first).passed).toBe(false);

    // The second admin, on the same address, is untouched by that.
    for (let i = 0; i < rules.read.max; i += 1) {
      expect(send(limiter, second).passed).toBe(true);
    }
    expect(send(limiter, second).passed).toBe(false);
  });

  it("does not let a different IP earn a fresh budget for the same user", () => {
    // The mirror image: a stolen session replayed from elsewhere must not reset
    // the counter just by arriving from a new address.
    const limiter = createRateLimiter({ rules });

    for (let i = 0; i < rules.read.max; i += 1) {
      expect(send(limiter, makeReq("admin-1", { ip: `10.0.0.${i}` })).passed).toBe(true);
    }
    expect(send(limiter, makeReq("admin-1", { ip: "203.0.113.9" })).passed).toBe(false);
  });

  it("meters reads, mutations and expensive scans as separate budgets", () => {
    const limiter = createRateLimiter({ rules });

    for (let i = 0; i < rules.mutation.max; i += 1) {
      expect(send(limiter, makeReq("admin-1", { method: "POST", path: "/owners/x/suspend" })).passed)
        .toBe(true);
    }
    const blockedWrite = send(limiter, makeReq("admin-1", { method: "POST", path: "/owners/x/suspend" }));
    expect(blockedWrite.passed).toBe(false);
    expect(blockedWrite.res.body).toMatchObject({ scope: "mutation" });

    // Spending the mutation budget must not cost the agent their ability to
    // read: they still have to see what they just did.
    expect(send(limiter, makeReq("admin-1", { path: "/tenants" })).passed).toBe(true);
  });

  it("classifies cross-owner scans as expensive whether or not the mount prefix is stripped", () => {
    expect(classifyRequest("GET", "/search")).toBe("expensive");
    expect(classifyRequest("GET", "/v1/admin/search")).toBe("expensive");
    expect(classifyRequest("GET", "/analytics/trends")).toBe("expensive");
    expect(classifyRequest("GET", "/tenants")).toBe("read");
    expect(classifyRequest("GET", "/owners/searchable-id")).toBe("read");
    expect(classifyRequest("DELETE", "/admins/1")).toBe("mutation");
    // Method does not rescue an expensive path.
    expect(classifyRequest("POST", "/exports")).toBe("expensive");
  });

  it("refills when the window rolls over", () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({ rules, now: () => now });
    const req = makeReq("admin-1", { path: "/search" });

    expect(send(limiter, req).passed).toBe(true);
    expect(send(limiter, req).passed).toBe(false);

    now += rules.expensive.windowMs + 1;
    expect(send(limiter, req).passed).toBe(true);
  });

  it("reports the remaining budget on every allowed request", () => {
    const limiter = createRateLimiter({ rules });
    const req = makeReq("admin-1");

    expect(send(limiter, req).res.headers["RateLimit-Remaining"]).toBe(rules.read.max - 1);
    expect(send(limiter, req).res.headers["RateLimit-Remaining"]).toBe(rules.read.max - 2);
    expect(send(limiter, req).res.headers["RateLimit-Limit"]).toBe(rules.read.max);
  });

  it("meters nothing when there is no authenticated user", () => {
    // Unauthenticated requests are already answered 401 by requireAuth, which
    // runs first. Keying them would mean inventing an identity, and the only
    // one available is the proxy's IP — the shared bucket this avoids.
    const limiter = createRateLimiter({ rules });
    for (let i = 0; i < rules.read.max + 5; i += 1) {
      expect(send(limiter, makeReq(undefined)).passed).toBe(true);
    }
  });

  it("is mounted on /v1/admin behind requireAuth so it can see req.user", () => {
    const indexSource = readFileSync(resolve(import.meta.dirname, "../index.ts"), "utf8");
    const mount = indexSource.match(/app\.use\("\/v1\/admin"[^)]*\)/)![0];

    expect(mount).toContain("requireAuth");
    expect(mount).toContain("adminRateLimit");
    expect(mount.indexOf("requireAuth")).toBeLessThan(mount.indexOf("adminRateLimit"));
    expect(mount.indexOf("adminRateLimit")).toBeLessThan(mount.indexOf("adminRouter"));
  });
});
