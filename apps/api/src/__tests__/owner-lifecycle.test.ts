import { describe, expect, it, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Response } from "express";

/**
 * Owner account lifecycle: suspension is enforced in exactly one place for
 * session-backed owner routes (`requireOwner`) and by hand on the one surface
 * that does not pass through it (`/public` capability-token routes).
 *
 * These are unit-level: the integration suite needs TEST_DATABASE_URL, which is
 * unset by default, and the three properties that actually matter here are
 * decisions, not queries. What must not drift:
 *
 *   1. a suspended owner is refused,
 *   2. an *impersonated* request for that same owner is not — otherwise support
 *      cannot investigate the account they were just asked to pause,
 *   3. public writes are refused while the public invoice read keeps working.
 */

const h = vi.hoisted(() => {
  /** FIFO of result sets; each `db.select()` consumes one. */
  const results: unknown[][] = [];
  let selectCalls = 0;

  const CHAIN_METHODS = ["from", "where", "limit", "innerJoin", "leftJoin", "orderBy"] as const;

  function chain() {
    const node: Record<string, unknown> = {
      // Resolved lazily, at await time, so the queue is consumed in the order
      // the handler actually issues its queries rather than the order the chain
      // happened to be built.
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(results.shift() ?? []).then(resolve),
    };
    for (const method of CHAIN_METHODS) node[method] = () => node;
    return node;
  }

  return {
    results,
    reset() {
      results.length = 0;
      selectCalls = 0;
    },
    get selectCalls() {
      return selectCalls;
    },
    db: {
      select: () => {
        selectCalls += 1;
        return chain();
      },
    },
  };
});

vi.mock("@pgkhata/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@pgkhata/db")>()),
  db: h.db,
}));

import { app } from "../index";
import { requireOwner, type AuthenticatedRequest } from "../middleware/auth";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const PROPERTY_ID = "22222222-2222-4222-8222-222222222222";
const ROOM_ID = "33333333-3333-4333-8333-333333333333";

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: OWNER_ID,
    userId: "user-1",
    phone: "9876543210",
    status: "active",
    suspendedAt: null,
    suspendedReason: null,
    suspendedBy: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface FakeResponse {
  statusCode?: number;
  body?: unknown;
}

async function runRequireOwner(req: Partial<AuthenticatedRequest>) {
  const captured: FakeResponse = {};
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;

  const next = vi.fn();
  await requireOwner(req as AuthenticatedRequest, res, next);
  return { captured, next, req: req as AuthenticatedRequest };
}

const USER = { id: "user-1", email: "owner@example.com", name: "Owner" };

beforeEach(() => {
  h.reset();
});

describe("requireOwner refuses a non-active account", () => {
  it("answers 403 account_suspended and carries the reason", async () => {
    h.results.push([
      profile({
        status: "suspended",
        suspendedAt: new Date(),
        suspendedReason: "Chargeback investigation opened by payments",
      }),
    ]);

    const { captured, next, req } = await runRequireOwner({ user: USER });

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(403);
    expect(captured.body).toEqual({
      error: "account_suspended",
      reason: "Chargeback investigation opened by payments",
    });
    // The owner must not be scoped into the request: a handler that runs anyway
    // because req.ownerId happened to be set is the failure this prevents.
    expect(req.ownerId).toBeUndefined();
  });

  it.each(["pending_deletion", "deleted"])(
    "refuses status %s as well, not just suspended",
    async (status) => {
      h.results.push([profile({ status })]);

      const { captured, next } = await runRequireOwner({ user: USER });

      expect(next).not.toHaveBeenCalled();
      expect(captured.statusCode).toBe(403);
      expect(captured.body).toMatchObject({ error: "account_suspended" });
    },
  );

  it("lets an active owner through and scopes the request", async () => {
    h.results.push([profile()]);

    const { captured, next, req } = await runRequireOwner({ user: USER });

    expect(captured.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(req.ownerId).toBe(OWNER_ID);
  });
});

describe("impersonation bypasses the suspension check", () => {
  it("scopes an impersonated request to the suspended owner instead of refusing it", async () => {
    // Nothing is queued on purpose: if the guard ever reads the profile row on
    // an impersonated request, it would see an empty result and fail loudly
    // rather than pass by accident.
    const { captured, next, req } = await runRequireOwner({
      user: USER,
      impersonation: { targetOwnerId: OWNER_ID } as AuthenticatedRequest["impersonation"],
    });

    expect(captured.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(req.ownerId).toBe(OWNER_ID);
    // Support reaches the suspended account without the row being consulted at
    // all — the status gate is on the customer, not on the platform.
    expect(h.selectCalls).toBe(0);
  });
});

describe("public capability-token routes", () => {
  const signupBody = {
    name: "Asha R",
    phone: "9876543210",
    roomId: ROOM_ID,
    documents: [
      {
        type: "aadhaar" as const,
        fileName: "aadhaar.jpg",
        fileBase64: "ZmFrZQ==",
        contentType: "image/jpeg",
      },
    ],
  };

  it("still serves an invoice while the owner is suspended", async () => {
    h.results.push([
      {
        bill: {
          billMonth: "2026-08",
          lineItems: [],
          totalAmount: 8000,
          paidAmount: 8000,
          balance: 0,
          status: "paid",
          dueDate: "2026-08-05",
          voidedAt: null,
        },
        tenantName: "Asha R",
        propertyName: "Sunrise PG",
        roomNumber: "101",
        upiVpa: "sunrise@upi",
      },
    ]);

    const res = await request(app).get("/public/invoice/invoice-token");

    expect(res.status).toBe(200);
    expect(res.body.invoice).toMatchObject({ totalAmount: 8000, tenantName: "Asha R" });
    // One query, and it never joins owner_profile: the read is deliberately not
    // gated, so a tenant keeps the receipt for rent they already paid.
    expect(h.selectCalls).toBe(1);
  });

  it("refuses a public signup submission for a suspended owner", async () => {
    h.results.push([{ id: PROPERTY_ID, name: "Sunrise PG" }]); // token lookup
    h.results.push([{ status: "suspended" }]); // propertyOwnerActive

    const res = await request(app).post("/public/signup/signup-token").send(signupBody);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("account_suspended");
    // Refused before the room lookup, so nothing downstream ran.
    expect(h.selectCalls).toBe(2);
    // The owner's justification is theirs, not the public internet's.
    expect(JSON.stringify(res.body)).not.toContain("Chargeback");
  });

  it("refuses a public complaint submission for a suspended owner", async () => {
    h.results.push([{ id: PROPERTY_ID, name: "Sunrise PG" }]);
    h.results.push([{ status: "deleted" }]);

    const res = await request(app)
      .post("/public/complaint/complaint-token")
      .send({ subject: "No water", description: "Second floor since morning", roomId: ROOM_ID });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("account_suspended");
    expect(h.selectCalls).toBe(2);
  });

  it("lets a public complaint through while the owner is active", async () => {
    h.results.push([{ id: PROPERTY_ID, name: "Sunrise PG" }]);
    h.results.push([{ status: "active" }]);
    h.results.push([]); // room lookup: empty, so the handler stops at its own 404

    const res = await request(app)
      .post("/public/complaint/complaint-token")
      .send({ subject: "No water", description: "Second floor since morning", roomId: ROOM_ID });

    // Reaching the handler's own "Room not found" proves the lifecycle guard
    // passed rather than the request simply failing for a different reason.
    expect(res.status).toBe(404);
    expect(h.selectCalls).toBe(3);
  });
});
