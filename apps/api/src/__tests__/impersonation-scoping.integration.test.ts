import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, bed, bill, property, room, tenant } from "@pgkhata/db";
import { app } from "../index";
import {
  createPlatformAdmin,
  createTestOwner,
  openGrant,
  teardownAdmins,
  teardownOwners,
  type Grant,
  type TestAdmin,
  type TestOwner,
} from "./helpers/admin";

/**
 * What a support session is *scoped to*.
 *
 * The middleware unit tests prove the decision table; they cannot prove that a
 * request carrying only a `pgk_imp` cookie resolves to one specific owner's
 * rows in the database and to nobody else's. That is this file.
 *
 * Runs only when TEST_DATABASE_URL is present.
 */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
const REASON = "Owner reports a missing bill on their January invoice";

let admin: TestAdmin;
let ownerB: TestOwner;
let ownerC: TestOwner;
let grant: Grant;

let propertyB: string;
let propertyC: string;
let roomB: string;
let tenantB: string;
let billB: string;

describeDb("impersonation scoping (database)", () => {
  beforeAll(async () => {
    admin = await createPlatformAdmin(app, {
      label: `imp-scope-admin-${suffix}`,
      role: "super_admin",
    });
    ownerB = await createTestOwner(app, { label: `imp-scope-b-${suffix}` });
    ownerC = await createTestOwner(app, { label: `imp-scope-c-${suffix}` });

    // Created by the owners themselves, through the real owner API, so the rows
    // under test are ordinary owner data rather than fixtures shaped to pass.
    const createdB = await request(app)
      .post("/v1/properties")
      .set("Cookie", ownerB.cookie)
      .send({ name: `Scope PG B ${suffix}` });
    expect(createdB.status).toBe(201);
    propertyB = createdB.body.id;

    const createdC = await request(app)
      .post("/v1/properties")
      .set("Cookie", ownerC.cookie)
      .send({ name: `Scope PG C ${suffix}` });
    expect(createdC.status).toBe(201);
    propertyC = createdC.body.id;

    const [r] = await db
      .insert(room)
      .values({ propertyId: propertyB, number: "101", capacity: 2, monthlyRent: 6500 })
      .returning();
    roomB = r!.id;

    const [t] = await db
      .insert(tenant)
      .values({
        propertyId: propertyB,
        roomId: roomB,
        name: `Scope Tenant B ${suffix}`,
        phone: `8${String(suffix).slice(-9)}`,
        joiningDate: new Date(),
        status: "active",
      })
      .returning();
    tenantB = t!.id;

    const [b] = await db
      .insert(bill)
      .values({
        tenantId: tenantB,
        billMonth: "2026-01",
        rentAmount: 6500,
        totalAmount: 6500,
        balance: 6500,
      })
      .returning();
    billB = b!.id;

    grant = await openGrant(app, admin, ownerB.ownerId, REASON);
  });

  afterAll(async () => {
    await db.delete(bill).where(eq(bill.id, billB));
    await db.update(tenant).set({ bedId: null }).where(eq(tenant.id, tenantB));
    await db.delete(tenant).where(eq(tenant.id, tenantB));
    await db.delete(bed).where(eq(bed.roomId, roomB));
    await db.delete(room).where(eq(room.id, roomB));
    // charge_type rows seeded on property creation cascade with the property.
    await db.delete(property).where(inArray(property.id, [propertyB, propertyC]));
    await teardownAdmins([admin]);
    await teardownOwners([ownerB, ownerC]);
  });

  it("resolves an impersonated request to the target owner's real data", async () => {
    const properties = await request(app).get("/v1/properties").set("Cookie", grant.cookie);
    expect(properties.status).toBe(200);

    const ids = (properties.body as { id: string }[]).map((p) => p.id);
    expect(ids).toContain(propertyB);
    // The grant is scoped to one owner, not widened to the platform.
    expect(ids).not.toContain(propertyC);

    const detail = await request(app)
      .get(`/v1/properties/${propertyB}`)
      .set("Cookie", grant.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(propertyB);
  });

  it("reads the target owner's tenants and bills", async () => {
    const tenants = await request(app)
      .get(`/v1/properties/${propertyB}/tenants`)
      .set("Cookie", grant.cookie);
    expect(tenants.status).toBe(200);
    expect((tenants.body as { id: string }[]).map((t) => t.id)).toContain(tenantB);

    const bills = await request(app)
      .get(`/v1/properties/${propertyB}/bills`)
      .set("Cookie", grant.cookie);
    expect(bills.status).toBe(200);
    expect((bills.body as { id: string }[]).map((b) => b.id)).toContain(billB);
  });

  it("cannot reach a third owner's property, and answers 404 rather than 403", async () => {
    // 403 would confirm the id exists and belongs to someone. Every one of
    // these must be indistinguishable from a property that was never created.
    const paths = [
      `/v1/properties/${propertyC}`,
      `/v1/properties/${propertyC}/rooms`,
      `/v1/properties/${propertyC}/tenants`,
      `/v1/properties/${propertyC}/bills`,
    ];

    for (const path of paths) {
      const res = await request(app).get(path).set("Cookie", grant.cookie);
      expect(res.status, `${path} should be 404`).toBe(404);
      expect(res.status, `${path} must not confirm the property exists`).not.toBe(403);
    }
  });

  it("answers the same 404 for a property id that never existed", async () => {
    // Pins the previous test's meaning: the two cases are identical to a caller,
    // which is the whole point of choosing 404 over 403.
    const missing = await request(app)
      .get("/v1/properties/00000000-0000-4000-8000-000000000000/tenants")
      .set("Cookie", grant.cookie);
    const foreign = await request(app)
      .get(`/v1/properties/${propertyC}/tenants`)
      .set("Cookie", grant.cookie);

    expect(missing.status).toBe(foreign.status);
    expect(missing.body).toEqual(foreign.body);
  });

  it("proves owner C's property really exists, so the 404 above is deliberate", async () => {
    // Without this the 404 test would also pass against a broken fixture.
    const res = await request(app)
      .get(`/v1/properties/${propertyC}/tenants`)
      .set("Cookie", ownerC.cookie);
    expect(res.status).toBe(200);
  });

  it("returns the owner's identity from /v1/profile, not the admin's", async () => {
    const res = await request(app).get("/v1/profile").set("Cookie", grant.cookie);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ownerB.ownerId);
    expect(res.body.email).toBe(ownerB.email);
    expect(res.body.name).toBe(ownerB.name);
    // The human behind the session is never the identity the handlers see.
    expect(res.body.email).not.toBe(admin.email);
  });

  it("reports the session on /v1/impersonation/status without leaking the wrong owner", async () => {
    const res = await request(app)
      .get("/v1/impersonation/status")
      .set("Cookie", grant.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      active: true,
      mode: "read_only",
      canWrite: false,
      adminName: admin.name,
      ownerName: ownerB.name,
      reason: REASON,
    });
  });

  it("leaves a genuine owner's own session completely unaffected", async () => {
    // Owner C signs in normally while the grant is live; nothing about the
    // support session may follow their cookie.
    const res = await request(app).get("/v1/properties").set("Cookie", ownerC.cookie);
    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((p) => p.id);
    expect(ids).toContain(propertyC);
    expect(ids).not.toContain(propertyB);

    const status = await request(app)
      .get("/v1/impersonation/status")
      .set("Cookie", ownerC.cookie);
    expect(status.body).toEqual({ active: false });
  });

  it("drops the grant when a real owner session is present on the same request", async () => {
    // A stale grant cookie sitting in a genuine owner's browser must never
    // re-scope that owner's own session.
    const res = await request(app)
      .get("/v1/properties")
      .set("Cookie", [...ownerC.cookie, ...grant.cookie]);

    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((p) => p.id);
    expect(ids).toContain(propertyC);
    expect(ids).not.toContain(propertyB);
  });
});
