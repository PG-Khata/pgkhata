import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, user, ownerProfile, property, room, bed, tenant, securityDeposit } from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let phoneSeq = 0;
function nextPhone() {
  phoneSeq += 1;
  const base = 9_500_000_000 + (suffix % 400_000) * 100;
  return String(base + phoneSeq);
}

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `deposit-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Deposit ${label}`, email, password: "deposit-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Deposit PG ${label} ${suffix}` });

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  await db.delete(securityDeposit).where(eq(securityDeposit.propertyId, owner.propertyId));

  const rooms = await db
    .select({ id: room.id })
    .from(room)
    .where(eq(room.propertyId, owner.propertyId));
  const roomIds = rooms.map((r) => r.id);

  const allTenants = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.propertyId, owner.propertyId));
  const tenantIds = allTenants.map((t) => t.id);

  if (tenantIds.length > 0) {
    await db.update(tenant).set({ bedId: null }).where(inArray(tenant.id, tenantIds));
    await db.delete(tenant).where(inArray(tenant.id, tenantIds));
  }
  if (roomIds.length > 0) {
    await db.delete(bed).where(inArray(bed.roomId, roomIds));
    await db.delete(room).where(inArray(room.id, roomIds));
  }
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;
let bob: Owner;
let aliceTenantId: string;

describeDb("security deposits (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");

    const roomRes = await request(app)
      .post(`/v1/properties/${alice.propertyId}/rooms`)
      .set("Cookie", alice.cookie)
      .send({ number: "101", capacity: 1, monthlyRent: 6000 });

    const tenantRes = await request(app)
      .post(`/v1/properties/${alice.propertyId}/tenants`)
      .set("Cookie", alice.cookie)
      .send({
        name: "Deposit Tenant",
        phone: nextPhone(),
        roomId: roomRes.body.id,
        joiningDate: new Date().toISOString(),
      });
    aliceTenantId = tenantRes.body.id;
  }, 20000);

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function url(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/security-deposits${path}`;
  }

  it("requires authentication", async () => {
    const res = await request(app).get(url(alice));
    expect(res.status).toBe(401);
  });

  it("records a deposit as held", async () => {
    const res = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 12000 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("held");
    expect(res.body.refundAmount).toBe(0);
  });

  it("rejects a non-positive amount", async () => {
    const res = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 0 });

    expect(res.status).toBe(400);
  });

  it("refuses a deposit for a tenant belonging to another owner", async () => {
    const res = await request(app)
      .post(url(bob))
      .set("Cookie", bob.cookie)
      .send({ tenantId: aliceTenantId, amount: 5000 });

    expect(res.status).toBe(404);
  });

  it("lists deposits scoped to the property and hides another owner's", async () => {
    const aliceList = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    expect(aliceList.body).toHaveLength(1);

    const bobList = await request(app).get(url(bob)).set("Cookie", bob.cookie);
    expect(bobList.body).toHaveLength(0);
  });

  it("refuses to read another owner's deposit by id", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const depositId = list.body[0].deposit.id;

    const res = await request(app).get(url(bob, `/${depositId}`)).set("Cookie", bob.cookie);
    expect(res.status).toBe(404);
  });

  it("issues a partial refund and leaves the deposit partial", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const depositId = list.body[0].deposit.id;

    const res = await request(app)
      .post(url(alice, `/${depositId}/refund`))
      .set("Cookie", alice.cookie)
      .send({ amount: 5000 });

    expect(res.status).toBe(200);
    expect(res.body.refundAmount).toBe(5000);
    expect(res.body.status).toBe("partial");
  });

  it("refuses a refund exceeding what remains outstanding", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const depositId = list.body[0].deposit.id;

    // Only 7000 remains (12000 - 5000).
    const res = await request(app)
      .post(url(alice, `/${depositId}/refund`))
      .set("Cookie", alice.cookie)
      .send({ amount: 8000 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/exceeds what remains outstanding/i);
  });

  it("marks the deposit fully refunded once the remainder is issued", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const depositId = list.body[0].deposit.id;

    const res = await request(app)
      .post(url(alice, `/${depositId}/refund`))
      .set("Cookie", alice.cookie)
      .send({ amount: 7000 });

    expect(res.status).toBe(200);
    expect(res.body.refundAmount).toBe(12000);
    expect(res.body.status).toBe("refunded");
    expect(res.body.refundDate).toBeTruthy();
  });

  it("refuses any further refund on an already fully refunded deposit", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const depositId = list.body[0].deposit.id;

    const res = await request(app)
      .post(url(alice, `/${depositId}/refund`))
      .set("Cookie", alice.cookie)
      .send({ amount: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been fully refunded/i);
  });

  it("refuses to refund another owner's deposit", async () => {
    const created = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 3000 });

    const res = await request(app)
      .post(url(bob, `/${created.body.id}/refund`))
      .set("Cookie", bob.cookie)
      .send({ amount: 1000 });

    expect(res.status).toBe(404);
  });

  it("reports a liability report that reconciles held minus refunded", async () => {
    const secondTenant = await request(app)
      .post(`/v1/properties/${alice.propertyId}/tenants`)
      .set("Cookie", alice.cookie)
      .send({ name: "Second Deposit Tenant", phone: nextPhone(), joiningDate: new Date().toISOString() });

    await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: secondTenant.body.id, amount: 9000 });

    const report = await request(app).get(url(alice, "/liability-report")).set("Cookie", alice.cookie);

    expect(report.status).toBe(200);
    expect(report.body.netLiability).toBe(report.body.totalHeld - report.body.totalRefunded);

    // Cross-check directly against the database.
    const rows = await db
      .select({ amount: securityDeposit.amount, refundAmount: securityDeposit.refundAmount })
      .from(securityDeposit)
      .where(eq(securityDeposit.propertyId, alice.propertyId));
    const expectedHeld = rows.reduce((sum, r) => sum + r.amount, 0);
    const expectedRefunded = rows.reduce((sum, r) => sum + r.refundAmount, 0);

    expect(report.body.totalHeld).toBe(expectedHeld);
    expect(report.body.totalRefunded).toBe(expectedRefunded);
  });

  it("scopes the liability report to the requesting owner only", async () => {
    const bobReport = await request(app).get(url(bob, "/liability-report")).set("Cookie", bob.cookie);

    expect(bobReport.status).toBe(200);
    expect(bobReport.body).toEqual({ totalHeld: 0, totalRefunded: 0, netLiability: 0 });
  });
});
