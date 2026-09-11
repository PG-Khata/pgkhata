import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../index";
import adminRouter from "../routes/admin";

/**
 * The admin surface is guarded once, at the root of the router, rather than by
 * each route repeating `requireAuth, requirePlatformAdmin`. That removes the
 * "someone forgets a guard" failure mode but introduces a new one: a sub-router
 * mounted somewhere other than under that gate. These tests read the mounted
 * stack rather than a fixed list, so either mistake fails CI the day it is made.
 */

interface Layer {
  name: string;
  handle?: { stack?: Layer[] };
  matchers?: ((path: string) => unknown)[];
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { name: string }[];
  };
}

interface AdminRoute {
  id: string;
  method: string;
  path: string;
  handlers: string[];
}

/**
 * Express does NOT copy router-level `.use()` middleware into a route's own
 * `route.stack` — verified below — so reading `route.stack` alone would now
 * report every admin route as unguarded and the suite would pass vacuously
 * while asserting nothing. The walk therefore carries middleware down into
 * nested routers, in registration order, exactly as a request would traverse it.
 */
function collectRoutes(stack: Layer[], inherited: string[], out: AdminRoute[]): void {
  // Middleware only guards what is registered after it, which is why this
  // accumulates as the stack is walked rather than being gathered up front.
  const carried = [...inherited];

  for (const layer of stack) {
    if (layer.route) {
      const handlers = [...carried, ...layer.route.stack.map((h) => h.name)];
      for (const method of Object.keys(layer.route.methods)) {
        out.push({
          id: `${method.toUpperCase()} ${layer.route.path}`,
          method: method.toUpperCase(),
          path: layer.route.path,
          handlers,
        });
      }
      continue;
    }

    const nested = layer.handle?.stack;
    if (nested) {
      // Sub-routers are mounted at the root, so a route's `path` is already its
      // full path. Asserting it here keeps that true: mount one under a prefix
      // and this fails rather than silently reporting truncated paths.
      expect(
        layer.matchers?.some((match) => match("/")),
        "admin sub-routers must be mounted at the root",
      ).toBe(true);
      collectRoutes(nested, carried, out);
      continue;
    }

    carried.push(layer.name);
  }
}

function mountedAdminRoutes(): AdminRoute[] {
  const stack = (adminRouter as unknown as { stack: Layer[] }).stack;
  const routes: AdminRoute[] = [];
  collectRoutes(stack, [], routes);
  return routes;
}

const ROUTES = mountedAdminRoutes();

/**
 * Writes that destroy data or hand out privilege, plus the repairs — which only
 * re-derive state, but re-derive it across every owner at once. `support` must
 * not reach any of these.
 */
const SUPER_ADMIN_ONLY: [string, string][] = [
  ["PUT", "/owners/:ownerId"],
  ["POST", "/bills/:billId/recompute"],
  ["POST", "/properties/:propertyId/reconcile-beds"],
  ["POST", "/properties/:propertyId/reconcile-overdue"],
  ["POST", "/blog/posts"],
  ["PUT", "/blog/posts/:postId"],
  ["DELETE", "/blog/posts/:postId"],
  ["PATCH", "/blog/posts/:postId/publish"],
  ["GET", "/audit"],
  ["GET", "/audit/:auditId"],
  ["GET", "/admins"],
  ["POST", "/admins"],
  ["PATCH", "/admins/:adminId"],
  ["DELETE", "/admins/:adminId"],
];

/**
 * Mutations deleted because each re-implemented an owner route without its
 * guards — no `syncBillTotals`, no bed-occupancy check, no rent-plan creation.
 * Support reaches the correct versions through impersonation. Listed so that
 * re-adding one to the admin surface has to be a deliberate edit here too.
 */
const DELETED: [string, string][] = [
  ["PATCH", "/bills/:billId"],
  ["POST", "/bills/:billId/void"],
  ["PUT", "/payments/:paymentId"],
  ["DELETE", "/payments/:paymentId"],
  ["PATCH", "/beds/:bedId"],
  ["POST", "/tenants/:tenantId/approve"],
  ["POST", "/tenants/:tenantId/reject"],
  ["PUT", "/tenants/:tenantId"],
  ["PUT", "/properties/:propertyId"],
  ["DELETE", "/owners/:ownerId"],
  ["DELETE", "/properties/:propertyId"],
  ["DELETE", "/tenants/:tenantId"],
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

describe("admin router guards", () => {
  it("mounts a non-trivial number of routes", () => {
    // Guards against the suite silently passing because introspection broke.
    expect(ROUTES.length).toBeGreaterThan(30);
  });

  it("does not find the guards in the routes' own handler stacks", () => {
    // The premise of the walk above. If a future Express did copy router-level
    // middleware into `route.stack`, this fails and the walk can be simplified
    // — rather than double-counting guards and hiding a real gap.
    const own = ROUTES.map((r) => r.handlers);
    expect(own.length).toBeGreaterThan(0);
    const rawStack = (adminRouter as unknown as { stack: Layer[] }).stack;
    const anyRoute = rawStack.find((l) => l.route);
    expect(anyRoute?.route?.stack.map((h) => h.name)).not.toContain("requireAuth");
  });

  it.each(ROUTES.map((r) => [r.id, r] as const))(
    "%s requires authentication and an admin guard",
    (_id, route) => {
      expect(route.handlers).toContain("requireAuth");
      expect(route.handlers.some((h) => h.startsWith("adminGuard:"))).toBe(true);
    },
  );

  it.each(ROUTES.map((r) => [r.id, r] as const))(
    "%s runs requireAuth before its admin guard",
    (_id, route) => {
      const authIndex = route.handlers.indexOf("requireAuth");
      const guardIndex = route.handlers.findIndex((h) => h.startsWith("adminGuard:"));
      // The guard reads req.user, which requireAuth populates.
      expect(authIndex).toBeGreaterThanOrEqual(0);
      expect(guardIndex).toBeGreaterThan(authIndex);
    },
  );

  it.each(SUPER_ADMIN_ONLY.map(([m, p]) => [`${m} ${p}`, m, p] as const))(
    "%s is restricted to super_admin",
    (id, method, path) => {
      const route = ROUTES.find((r) => r.method === method && r.path === path);
      expect(route, `${id} is not mounted`).toBeDefined();
      expect(route!.handlers).toContain("adminGuard:super_admin");
    },
  );

  it.each(DELETED.map(([m, p]) => [`${m} ${p}`, m, p] as const))(
    "%s stays deleted",
    (_id, method, path) => {
      expect(ROUTES.find((r) => r.method === method && r.path === path)).toBeUndefined();
    },
  );

  it("has no sub-router middleware that leaks onto sibling routers", () => {
    /**
     * Every admin sub-router is mounted at "/", so a `router.use(guard)` inside
     * one of them runs for EVERY request reaching that point in the parent
     * stack — including requests a later sibling actually handles. That is not
     * theoretical: `requireSuperAdminRole` at the top of audit.ts and admins.ts
     * made `support` admins get 403 from POST /owners/:id/impersonate, the core
     * support action, even though that route is deliberately open to them.
     *
     * The walk above models middleware as scoped to its own router, so it
     * cannot see this. Role guards therefore belong on individual routes.
     */
    const rawStack = (adminRouter as unknown as { stack: Layer[] }).stack;
    const offenders: string[] = [];

    for (const layer of rawStack) {
      const nested = layer.handle?.stack;
      if (!nested) continue;
      for (const inner of nested) {
        // A layer with neither a route nor its own nested stack is bare
        // middleware, and at a "/" mount it applies to everything downstream.
        if (!inner.route && !inner.handle?.stack) offenders.push(inner.name);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("leaves no destructive route reachable by support", () => {
    const superAdminIds = new Set(SUPER_ADMIN_ONLY.map(([m, p]) => `${m} ${p}`));
    const permissive = ROUTES.filter(
      (r) =>
        !SAFE_METHODS.has(r.method) &&
        !superAdminIds.has(r.id) &&
        // Every route now inherits `adminGuard:any` from the root gate, so the
        // question is no longer "does it have the permissive guard" but "does
        // it lack the restrictive one".
        !r.handlers.includes("adminGuard:super_admin"),
    ).map((r) => r.id);

    // Any new write route shows up here and must be triaged deliberately.
    // Each entry below is a considered decision, not an oversight:
    //   end-all / sessions/:id/end - ending a support session is always
    //     de-escalation, and `support` is scoped to its own sessions.
    //   owners/:ownerId/impersonate - starting a read-only support session IS
    //     the support job. It grants no write access by itself.
    expect(permissive.sort()).toEqual([
      "POST /impersonation/end-all",
      "POST /impersonation/sessions/:sessionId/end",
      "POST /owners/:ownerId/impersonate",
    ]);
  });
});

describe("admin routes reject anonymous callers", () => {
  it.each([
    ["GET", "/v1/admin/me"],
    ["GET", "/v1/admin/analytics"],
    ["GET", "/v1/admin/owners"],
    ["GET", "/v1/admin/admins"],
    ["GET", "/v1/admin/audit"],
    ["POST", "/v1/admin/admins"],
  ] as const)("%s %s answers 401 without a session", async (method, path) => {
    const res = await (method === "GET"
      ? request(app).get(path)
      : request(app).post(path).send({}));
    expect(res.status).toBe(401);
  });

  it("answers 401 for a path under /v1/admin that matches no route", async () => {
    // The gate is mounted on the router itself, so it runs before routing
    // decides there is nothing here. That is the right order: an anonymous
    // caller learns nothing about which admin routes exist.
    const res = await request(app).get("/v1/admin/no-such-thing");
    expect(res.status).toBe(401);
  });
});

describe("the admin gate is mounted ahead of every route", () => {
  it("puts requireAuth and the admin guard first in the router stack", () => {
    const stack = (adminRouter as unknown as { stack: Layer[] }).stack;
    // A route registered above these would inherit neither, and the per-route
    // assertions above would not catch it because they read the same order.
    expect(stack.slice(0, 2).map((l) => l.name)).toEqual(["requireAuth", "adminGuard:any"]);
    expect(stack.findIndex((l) => l.route || l.handle?.stack)).toBe(2);
  });
});
