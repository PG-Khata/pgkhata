import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, adminAuditLog, property } from "@pgkhata/db";
import { app } from "../index";
import {
  auditRowsForSession,
  claimHandoff,
  clearsGrantCookie,
  createPlatformAdmin,
  createTestOwner,
  expireHandoff,
  grantCookieFrom,
  handoffTokenFrom,
  openGrant,
  readSession,
  rejectionMessage,
  setAdminActive,
  startImpersonation,
  teardownAdmins,
  teardownOwners,
  waitForAuditRows,
  type TestAdmin,
  type TestOwner,
} from "./helpers/admin";

/**
 * The life and death of a support session.
 *
 * Every assertion here is about a grant *stopping* working: once used, once
 * expired, once superseded, once the human behind it loses their access, and —
 * the one that matters most — the moment it is pointed back at /v1/admin.
 *
 * Runs only when TEST_DATABASE_URL is present.
 */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
const REASON = "Owner asked us to look at a bill they cannot open";

let admin: TestAdmin;
let owner: TestOwner;
let propertyId: string;

describeDb("impersonation session lifecycle (database)", () => {
  beforeAll(async () => {
    admin = await createPlatformAdmin(app, {
      label: `imp-life-admin-${suffix}`,
      role: "super_admin",
    });
    owner = await createTestOwner(app, { label: `imp-life-owner-${suffix}` });

    const created = await request(app)
      .post("/v1/properties")
      .set("Cookie", owner.cookie)
      .send({ name: `Lifecycle PG ${suffix}` });
    expect(created.status).toBe(201);
    propertyId = created.body.id;
  });

  afterAll(async () => {
    await setAdminActive(admin.adminId, true);
    await db.delete(property).where(eq(property.id, propertyId));
    await teardownAdmins([admin]);
    await teardownOwners([owner]);
  });

  it("burns the handoff token on first use", async () => {
    const started = await startImpersonation(app, admin, owner.ownerId, REASON);
    expect(started.status).toBe(201);
    const token = handoffTokenFrom(started.body.redirectUrl);

    const first = await claimHandoff(app, token);
    expect(first.status).toBe(200);
    expect(grantCookieFrom(first)).toHaveLength(1);

    // The URL lands in a browser address bar, a proxy log and a chat window.
    // Following it twice must not produce two live sessions.
    const second = await claimHandoff(app, token);
    expect(second.status).toBe(401);
    const issued = (second.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
    expect(issued.some((c) => c.startsWith("pgk_imp="))).toBe(false);
  });

  it("refuses a handoff that has expired", async () => {
    const started = await startImpersonation(app, admin, owner.ownerId, REASON);
    expect(started.status).toBe(201);
    await expireHandoff(started.body.sessionId);

    const claimed = await claimHandoff(app, handoffTokenFrom(started.body.redirectUrl));
    expect(claimed.status).toBe(401);

    const row = await readSession(started.body.sessionId);
    expect(row?.handoffClaimedAt).toBeNull();
    expect(row?.sessionTokenHash).toBeNull();
  });

  it("supersedes the admin's previous live session when a new one starts", async () => {
    const first = await openGrant(app, admin, owner.ownerId, REASON);
    expect(
      (await request(app).get("/v1/impersonation/status").set("Cookie", first.cookie)).body.active,
    ).toBe(true);

    const second = await openGrant(app, admin, owner.ownerId, "Second call from the same owner");

    const firstRow = await readSession(first.sessionId);
    expect(firstRow?.endedReason).toBe("superseded");
    expect(firstRow?.endedAt).not.toBeNull();

    // One admin, one live session: the abandoned cookie is dead immediately.
    const stale = await request(app).get("/v1/properties").set("Cookie", first.cookie);
    expect(stale.status).toBe(401);
    expect(
      (await request(app).get("/v1/impersonation/status").set("Cookie", first.cookie)).status,
    ).toBe(401);

    // ...and the replacement is live, so the 401 above is about supersession.
    expect((await request(app).get("/v1/properties").set("Cookie", second.cookie)).status).toBe(200);
  });

  it("kills a live grant the moment the admin behind it is deactivated", async () => {
    const grant = await openGrant(app, admin, owner.ownerId, REASON);
    expect((await request(app).get("/v1/properties").set("Cookie", grant.cookie)).status).toBe(200);

    // Revocation is a column flip, and it must take effect on the next request
    // rather than whenever the session would have expired on its own.
    await setAdminActive(admin.adminId, false);

    const denied = await request(app).get("/v1/properties").set("Cookie", grant.cookie);
    expect(denied.status).toBe(401);
    expect(clearsGrantCookie(denied)).toBe(true);
    expect(
      (await request(app).get("/v1/impersonation/status").set("Cookie", grant.cookie)).status,
    ).toBe(401);

    // Restoring access brings the same, still-unexpired grant back: proof the
    // denial came from the is_active flag and not from an expired session.
    await setAdminActive(admin.adminId, true);
    expect((await request(app).get("/v1/properties").set("Cookie", grant.cookie)).status).toBe(200);
  });

  it("ends the session on exit and leaves the cookie useless", async () => {
    const grant = await openGrant(app, admin, owner.ownerId, REASON);

    const exited = await request(app)
      .post("/v1/impersonation/exit")
      .set("Cookie", grant.cookie)
      .send({});
    expect(exited.status).toBe(200);
    expect(clearsGrantCookie(exited)).toBe(true);

    const row = await readSession(grant.sessionId);
    expect(row?.endedReason).toBe("admin_exit");
    expect(row?.endedAt).not.toBeNull();

    // A cookie the browser kept anyway must still be worthless.
    expect((await request(app).get("/v1/properties").set("Cookie", grant.cookie)).status).toBe(401);
    expect(
      (await request(app).get("/v1/impersonation/status").set("Cookie", grant.cookie)).status,
    ).toBe(401);
  });

  it("closes the privilege loop: a grant cannot re-enter /v1/admin", async () => {
    // The single most important assertion in this file. If an impersonated
    // request could reach the admin surface, support could act as an owner and
    // then use that owner session to act as the platform — including granting
    // itself super_admin.
    const grant = await openGrant(app, admin, owner.ownerId, REASON);

    const adminReads = [
      "/v1/admin/owners",
      "/v1/admin/me",
      "/v1/admin/analytics",
      "/v1/admin/admins",
      "/v1/admin/properties",
      "/v1/admin/impersonation/sessions",
    ];

    for (const path of adminReads) {
      const res = await request(app).get(path).set("Cookie", grant.cookie);
      expect(res.status, `GET ${path} under a grant`).toBe(403);
      expect(res.body).toMatchObject({ error: "Platform admin access required" });
    }

    // The same human, on their own admin session, is allowed everywhere above.
    // Without this control the 403s would also pass for a caller who simply
    // lacks privilege, which is not what is being proven.
    for (const path of adminReads) {
      const res = await request(app).get(path).set("Cookie", admin.cookie);
      expect(res.status, `GET ${path} as the admin themselves`).toBe(200);
    }

    // And it cannot mint a fresh session for a different owner either.
    const chained = await request(app)
      .post(`/v1/admin/owners/${owner.ownerId}/impersonate`)
      .set("Cookie", grant.cookie)
      .send({ reason: "Chaining a second session out of the first one" });
    expect(chained.status).toBe(403);
  });

  it("records start, claim, escalate, exit and the escalated write in the audit log", async () => {
    const writeReason = "Correcting the phone number the owner gave us on the call";
    const grant = await openGrant(app, admin, owner.ownerId, REASON);

    const escalated = await request(app)
      .post("/v1/impersonation/escalate")
      .set("Cookie", grant.cookie)
      .send({ reason: writeReason });
    expect(escalated.status).toBe(200);

    const written = await request(app)
      .patch("/v1/profile")
      .set("Cookie", grant.cookie)
      .send({ phone: "9876500001" });
    expect(written.status).toBe(200);

    const exited = await request(app)
      .post("/v1/impersonation/exit")
      .set("Cookie", grant.cookie)
      .send({});
    expect(exited.status).toBe(200);

    const required = [
      "impersonation.start",
      "impersonation.claim",
      "impersonation.escalate",
      "impersonation.exit",
    ];

    // The interceptor deliberately does not await its insert — an audit outage
    // must not become a customer-facing one — so poll instead of sleeping.
    const rows = await waitForAuditRows(
      () => auditRowsForSession(grant.sessionId),
      (found) => {
        const actions = found.map((r) => r.action);
        return (
          required.every((a) => actions.includes(a)) &&
          found.some((r) => r.method === "PATCH")
        );
      },
    );

    const actions = rows.map((r) => r.action);
    for (const action of required) {
      expect(actions, `missing ${action}`).toContain(action);
    }

    // The escalated write is attributed to the owner inside domain tables, so
    // this row is the only place the real human actor survives.
    const write = rows.find((r) => r.method === "PATCH");
    expect(write, "the escalated write was not recorded").toBeDefined();
    expect(write!.impersonationSessionId).toBe(grant.sessionId);
    expect(write!.adminId).toBe(admin.adminId);
    expect(write!.adminUserId).toBe(admin.userId);
    expect(write!.ownerId).toBe(owner.ownerId);
    expect(write!.statusCode).toBe(200);
    // The justification that authorised this specific write, not the session's.
    expect(write!.reason).toBe(writeReason);
    expect(write!.action.startsWith("impersonated.")).toBe(true);

    // Every row names an admin; none of them may be attributed to the owner.
    for (const row of rows) {
      expect(row.adminUserId).toBe(admin.userId);
      expect(row.adminUserId).not.toBe(owner.userId);
    }
  });

  it("refuses to rewrite the audit trail", async () => {
    // The append-only trigger is what makes the row above evidence rather than
    // a hint. A bug that UPDATEs or DELETEs here must fail loudly.
    const [row] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.adminUserId, admin.userId))
      .limit(1);
    expect(row, "no audit rows to test against").toBeDefined();

    const updated = await rejectionMessage(
      db.update(adminAuditLog).set({ reason: "tampered" }).where(eq(adminAuditLog.id, row!.id)),
    );
    expect(updated, "the UPDATE was not rejected").not.toBeNull();
    expect(updated).toMatch(/append-only/i);

    const deleted = await rejectionMessage(
      db.delete(adminAuditLog).where(eq(adminAuditLog.id, row!.id)),
    );
    expect(deleted, "the DELETE was not rejected").not.toBeNull();
    expect(deleted).toMatch(/append-only/i);

    const [after] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.id, row!.id))
      .limit(1);
    expect(after).toBeDefined();
    expect(after!.reason).toBe(row!.reason);
  });
});
