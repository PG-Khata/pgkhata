import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  user,
  ownerProfile,
  property,
  room,
  bed,
  tenant,
  bill,
  payment,
  advancePayment,
} from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let phoneSeq = 0;
function nextPhone() {
  phoneSeq += 1;
  const base = 9_400_000_000 + (suffix % 500_000) * 100;
  return String(base + phoneSeq);
}

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `advance-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Advance ${label}`, email, password: "advance-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Advance PG ${label} ${suffix}` });

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  const rooms = await db
    .select({ id: room.id })
    .from(room)
    .where(eq(room.propertyId, owner.propertyId));
  const roomIds = rooms.map((r) => r.id);

  if (roomIds.length > 0) {
    const tenants = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(inArray(tenant.roomId, roomIds));
    const tenantIds = tenants.map((t) => t.id);

    if (tenantIds.length > 0) {
      await db.delete(advancePayment).where(inArray(advancePayment.tenantId, tenantIds));
      const tenantBills = await db.select({ id: bill.id }).from(bill).where(inArray(bill.tenantId, tenantIds));
      for (const b of tenantBills) {
        await db.delete(payment).where(eq(payment.billId, b.id));
      }
      await db.delete(bill).where(inArray(bill.tenantId, tenantIds));
    }

    await db.update(tenant).set({ bedId: null }).where(inArray(tenant.roomId, roomIds));
    await db.delete(tenant).where(inArray(tenant.roomId, roomIds));
    await db.delete(bed).where(inArray(bed.roomId, roomIds));
    await db.delete(room).where(eq(room.propertyId, owner.propertyId));
  }
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;
let bob: Owner;
let aliceTenantId: string;
let aliceBillId: string;

describeDb("advance payments (database)", () => {
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
        name: "Advance Tenant",
        phone: nextPhone(),
        roomId: roomRes.body.id,
        joiningDate: new Date().toISOString(),
      });
    aliceTenantId = tenantRes.body.id;

    const generated = await request(app)
      .post(`/v1/properties/${alice.propertyId}/bills/generate`)
      .set("Cookie", alice.cookie)
      .send({ month: "2026-06" });
    aliceBillId = generated.body.bills[0].id;
  }, 20000);

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function url(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/advance-payments${path}`;
  }

  it("requires authentication", async () => {
    const res = await request(app).get(url(alice));
    expect(res.status).toBe(401);
  });

  it("records an advance for a tenant", async () => {
    const res = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 5000 });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(5000);
    expect(res.body.status).toBe("available");
    expect(res.body.appliedAmount).toBe(0);
  });

  it("rejects a non-positive amount", async () => {
    const res = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 0 });

    expect(res.status).toBe(400);
  });

  it("refuses an advance for a tenant belonging to another owner", async () => {
    const res = await request(app)
      .post(url(bob))
      .set("Cookie", bob.cookie)
      .send({ tenantId: aliceTenantId, amount: 1000 });

    expect(res.status).toBe(404);
  });

  it("lists advances for the property and for the tenant", async () => {
    const propertyList = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    expect(propertyList.body).toHaveLength(1);

    const tenantList = await request(app)
      .get(url(alice, `/tenant/${aliceTenantId}`))
      .set("Cookie", alice.cookie);
    expect(tenantList.body).toHaveLength(1);
  });

  it("hides another owner's advances", async () => {
    const res = await request(app).get(url(bob)).set("Cookie", bob.cookie);
    expect(res.body).toHaveLength(0);
  });

  it("applies part of an advance to a bill and reduces both balances", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const advanceId = list.body[0].advance.id;

    const res = await request(app)
      .post(url(alice, `/${advanceId}/apply`))
      .set("Cookie", alice.cookie)
      .send({ billId: aliceBillId, amount: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.amountApplied).toBe(2000);
    expect(res.body.advance.appliedAmount).toBe(2000);
    expect(res.body.advance.status).toBe("available");
    expect(res.body.bill.balance).toBe(4000); // 6000 - 2000

    const [b] = await db.select().from(bill).where(eq(bill.id, aliceBillId));
    expect(b!.paidAmount).toBe(2000);
    expect(b!.status).toBe("partial");
  });

  it("records the application as a payment with method advance", async () => {
    const payments = await db.select().from(payment).where(eq(payment.billId, aliceBillId));

    expect(payments).toHaveLength(1);
    expect(payments[0]!.method).toBe("advance");
    expect(payments[0]!.amount).toBe(2000);
  });

  it("refuses to apply more than what remains available on the advance", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const advanceId = list.body[0].advance.id;

    const res = await request(app)
      .post(url(alice, `/${advanceId}/apply`))
      .set("Cookie", alice.cookie)
      .send({ billId: aliceBillId, amount: 5000 }); // only 3000 left available

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/exceeds what remains available/i);
  });

  it("applies the remainder and marks the advance fully applied", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const advanceId = list.body[0].advance.id;

    const res = await request(app)
      .post(url(alice, `/${advanceId}/apply`))
      .set("Cookie", alice.cookie)
      .send({ billId: aliceBillId, amount: 3000 });

    expect(res.status).toBe(200);
    expect(res.body.advance.status).toBe("applied");
    expect(res.body.bill.balance).toBe(1000); // 4000 - 3000

    const [b] = await db.select().from(bill).where(eq(bill.id, aliceBillId));
    expect(b!.paidAmount).toBe(5000);
  });

  it("refuses further application once fully consumed", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const advanceId = list.body[0].advance.id;

    const res = await request(app)
      .post(url(alice, `/${advanceId}/apply`))
      .set("Cookie", alice.cookie)
      .send({ billId: aliceBillId, amount: 1 });

    expect(res.status).toBe(409);
  });

  it("refuses to apply more than a bill's outstanding balance", async () => {
    const secondAdvance = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 10000 });

    // Only ₹1000 remains owed on the bill.
    const res = await request(app)
      .post(url(alice, `/${secondAdvance.body.id}/apply`))
      .set("Cookie", alice.cookie)
      .send({ billId: aliceBillId, amount: 5000 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/exceeds the bill's outstanding balance/i);
  });

  it("applies without an amount by defaulting to the smaller of both limits", async () => {
    const secondAdvance = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 10000 });

    const res = await request(app)
      .post(url(alice, `/${secondAdvance.body.id}/apply`))
      .set("Cookie", alice.cookie)
      .send({ billId: aliceBillId });

    expect(res.status).toBe(200);
    expect(res.body.amountApplied).toBe(1000); // the bill's remaining balance
    expect(res.body.bill.balance).toBe(0);
  });

  it("forfeits an advance, making it terminal", async () => {
    const created = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 2000 });

    const forfeited = await request(app)
      .post(url(alice, `/${created.body.id}/forfeit`))
      .set("Cookie", alice.cookie);

    expect(forfeited.status).toBe(200);
    expect(forfeited.body.status).toBe("forfeited");

    const second = await request(app)
      .post(url(alice, `/${created.body.id}/forfeit`))
      .set("Cookie", alice.cookie);
    expect(second.status).toBe(409);
  });

  it("refuses to apply a forfeited advance", async () => {
    const created = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 3000 });
    await request(app)
      .post(url(alice, `/${created.body.id}/forfeit`))
      .set("Cookie", alice.cookie);

    // Fresh bill with balance to apply against.
    const generated = await request(app)
      .post(`/v1/properties/${alice.propertyId}/bills/generate`)
      .set("Cookie", alice.cookie)
      .send({ month: "2026-07" });

    const res = await request(app)
      .post(url(alice, `/${created.body.id}/apply`))
      .set("Cookie", alice.cookie)
      .send({ billId: generated.body.bills[0].id, amount: 500 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/forfeited/i);
  });

  it("refuses to apply another owner's advance", async () => {
    const created = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ tenantId: aliceTenantId, amount: 1000 });

    const res = await request(app)
      .post(url(bob, `/${created.body.id}/apply`))
      .set("Cookie", bob.cookie)
      .send({ billId: aliceBillId, amount: 500 });

    expect(res.status).toBe(404);
  });
});
