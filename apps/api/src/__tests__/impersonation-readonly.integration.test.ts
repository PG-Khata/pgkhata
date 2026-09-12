import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { db, adminAuditLog, ownerProfile, property } from "@pgkhata/db";
import { app } from "../index";
import {
  createPlatformAdmin,
  createTestOwner,
  lapseWriteWindow,
  openGrant,
  readSession,
  teardownAdmins,
  teardownOwners,
  type Grant,
  type TestAdmin,
  type TestOwner,
} from "./helpers/admin";

/**
 * A support session must be read-only until someone says, in writing, why it
 * should not be — and must go back to read-only on its own.
 *
 * The middleware unit tests cover the decision table against a fake request.
 * This file drives the real one end to end: the grant comes from the real
 * endpoints, the write window lives in Postgres, and the write it authorises is
 * an ordinary owner route.
 *
 * Runs only when TEST_DATABASE_URL is present.
 */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
const SESSION_REASON = "Owner cannot see their February bills in the app";
const WRITE_REASON = "Correcting the phone number the owner dictated on the call";

let admin: TestAdmin;
let owner: TestOwner;
let grant: Grant;
let propertyId: string;

function status() {
  return request(app).get("/v1/impersonation/status").set("Cookie", grant.cookie);
}

function patchProfile(phone: string) {
  return request(app).patch("/v1/profile").set("Cookie", grant.cookie).send({ phone });
}

async function ownerPhone() {
  const [row] = await db
    .select({ phone: ownerProfile.phone })
    .from(ownerProfile)
    .where(eq(ownerProfile.id, owner.ownerId))
    .limit(1);
  return row?.phone ?? null;
}

describeDb("impersonation read-only enforcement (database)", () => {
  beforeAll(async () => {
    admin = await createPlatformAdmin(app, {
      label: `imp-ro-admin-${suffix}`,
      role: "support",
    });
    owner = await createTestOwner(app, { label: `imp-ro-owner-${suffix}` });

    const created = await request(app)
      .post("/v1/properties")
      .set("Cookie", owner.cookie)
      .send({ name: `Read-only PG ${suffix}` });
    expect(created.status).toBe(201);
    propertyId = created.body.id;

    grant = await openGrant(app, admin, owner.ownerId, SESSION_REASON);
  });

  afterAll(async () => {
    await db.delete(property).where(eq(property.id, propertyId));
    await teardownAdmins([admin]);
    await teardownOwners([owner]);
  });

  it("starts read-only", async () => {
    const res = await status();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ active: true, mode: "read_only", canWrite: false });

    const row = await readSession(grant.sessionId);
    expect(row?.mode).toBe("read_only");
    expect(row?.writeExpiresAt).toBeNull();
  });

  it.each([
    ["POST", () => request(app).post("/v1/properties").send({ name: `Blocked ${suffix}` })],
    ["PUT", () => request(app).put(`/v1/properties/${propertyId}`).send({ name: "Renamed" })],
    ["PATCH", () => request(app).patch("/v1/profile").send({ phone: "9876543210" })],
    ["DELETE", () => request(app).delete(`/v1/properties/${propertyId}`)],
  ] as const)("%s on an owner route is refused with IMPERSONATION_READ_ONLY", async (_m, send) => {
    // Precondition rather than assumption, so this test does not depend on
    // having run before the escalation tests below.
    await lapseWriteWindow(grant.sessionId);
    expect((await status()).body.canWrite).toBe(false);

    const res = await send().set("Cookie", grant.cookie);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "IMPERSONATION_READ_ONLY" });
  });

  it("records a blocked read-only write attempt in the audit log", async () => {
    await lapseWriteWindow(grant.sessionId);
    const res = await patchProfile("9998887776");
    expect(res.status).toBe(403);

    // The audit write is fire-and-forget (an audit outage must not become a
    // customer-facing one), so poll briefly for the row rather than assuming it
    // has committed by the time the 403 returns.
    let rows: (typeof adminAuditLog.$inferSelect)[] = [];
    for (let attempt = 0; attempt < 20 && rows.length === 0; attempt += 1) {
      rows = await db
        .select()
        .from(adminAuditLog)
        .where(
          and(
            eq(adminAuditLog.impersonationSessionId, grant.sessionId),
            eq(adminAuditLog.statusCode, 403),
          ),
        );
      if (rows.length === 0) await new Promise((r) => setTimeout(r, 150));
    }

    // Previously the read-only guard answered 403 before the audit middleware
    // ran, so a support agent probing write endpoints left no trace at all.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.method).toBe("PATCH");
  });

  it("leaves the owner's data untouched after those refusals", async () => {
    // A 403 that still wrote would be the worst possible outcome.
    const [row] = await db.select().from(property).where(eq(property.id, propertyId)).limit(1);
    expect(row).toBeDefined();
    expect(row!.name).toBe(`Read-only PG ${suffix}`);

    const properties = await db.select().from(property).where(eq(property.ownerId, owner.ownerId));
    expect(properties).toHaveLength(1);
  });

  it("keeps every read working while read-only", async () => {
    await lapseWriteWindow(grant.sessionId);

    for (const path of [
      "/v1/properties",
      `/v1/properties/${propertyId}`,
      `/v1/properties/${propertyId}/tenants`,
      `/v1/properties/${propertyId}/bills`,
      "/v1/profile",
    ]) {
      const res = await request(app).get(path).set("Cookie", grant.cookie);
      expect(res.status, `GET ${path}`).toBe(200);
    }
  });

  it("rejects an escalation whose reason is shorter than 15 characters", async () => {
    const res = await request(app)
      .post("/v1/impersonation/escalate")
      .set("Cookie", grant.cookie)
      .send({ reason: "fixing stuff" });

    expect(res.status).toBe(400);

    // And the refusal must not have opened the window anyway.
    const after = await status();
    expect(after.body.canWrite).toBe(false);
    const blocked = await patchProfile("9876543210");
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: "IMPERSONATION_READ_ONLY" });
  });

  it("permits the same write once the session has been escalated", async () => {
    const before = await ownerPhone();

    const escalated = await request(app)
      .post("/v1/impersonation/escalate")
      .set("Cookie", grant.cookie)
      .send({ reason: WRITE_REASON });
    expect(escalated.status).toBe(200);
    expect(escalated.body.mode).toBe("read_write");

    const live = await status();
    expect(live.body).toMatchObject({ mode: "read_write", canWrite: true });

    const written = await patchProfile("9876543210");
    expect(written.status).toBe(200);

    // The write really landed; a 200 from a no-op handler would not prove it.
    const after = await ownerPhone();
    expect(after).toBe("+919876543210");
    expect(after).not.toBe(before);

    const row = await readSession(grant.sessionId);
    expect(row?.writeReason).toBe(WRITE_REASON);
  });

  it("refuses the same write again once the write window has lapsed", async () => {
    // Re-arm, prove it is open, then age it out in the database. The window is
    // evaluated by timestamp comparison on every request, so this is the state
    // a forgotten tab reaches on its own fifteen minutes later.
    const escalated = await request(app)
      .post("/v1/impersonation/escalate")
      .set("Cookie", grant.cookie)
      .send({ reason: WRITE_REASON });
    expect(escalated.status).toBe(200);
    expect((await patchProfile("9876543211")).status).toBe(200);

    await lapseWriteWindow(grant.sessionId);

    const lapsed = await status();
    // The mode column still says read_write; only the clock closed the window.
    expect(lapsed.body.mode).toBe("read_write");
    expect(lapsed.body.canWrite).toBe(false);

    const refused = await patchProfile("9876543212");
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: "IMPERSONATION_READ_ONLY" });
    expect(await ownerPhone()).toBe("+919876543211");

    // Reads are unaffected by the lapse.
    expect((await request(app).get("/v1/profile").set("Cookie", grant.cookie)).status).toBe(200);
  });

  it("lets the admin re-arm the window with a fresh justification", async () => {
    // Escalation is re-callable by design; a lapsed session must not be a dead
    // one, or support will start a second session instead of explaining itself.
    const res = await request(app)
      .post("/v1/impersonation/escalate")
      .set("Cookie", grant.cookie)
      .send({ reason: "Owner asked for one more correction on the same call" });
    expect(res.status).toBe(200);
    expect((await patchProfile("9876543213")).status).toBe(200);
    expect(await ownerPhone()).toBe("+919876543213");
  });
});
