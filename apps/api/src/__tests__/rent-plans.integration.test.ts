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
  rentPlan,
  tenant,
  bill,
} from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let phoneSeq = 0;
function nextPhone() {
  phoneSeq += 1;
  const base = 9_100_000_000 + (suffix % 800_000) * 100;
  return String(base + phoneSeq);
}

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `rentplan-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Rent Plan ${label}`, email, password: "rentplan-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Rent Plan PG ${label} ${suffix}` });

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
    for (const t of tenants) {
      await db.delete(bill).where(eq(bill.tenantId, t.id));
    }
    await db.update(tenant).set({ bedId: null }).where(inArray(tenant.roomId, roomIds));
    await db.delete(tenant).where(inArray(tenant.roomId, roomIds));
    await db.delete(bed).where(inArray(bed.roomId, roomIds));
    await db.update(room).set({ rentPlanId: null }).where(inArray(room.id, roomIds));
    await db.delete(room).where(eq(room.propertyId, owner.propertyId));
  }
  await db.delete(rentPlan).where(eq(rentPlan.propertyId, owner.propertyId));
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;
let bob: Owner;

describeDb("rent plans (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");
  });

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function plans(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/rent-plans${path}`;
  }
  function rooms(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/rooms${path}`;
  }

  it("requires authentication", async () => {
    const res = await request(app).get(plans(alice));
    expect(res.status).toBe(401);
  });

  it("creates a plan with defaults applied", async () => {
    const res = await request(app)
      .post(plans(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Standard", monthlyRent: 6500 });

    expect(res.status).toBe(201);
    expect(res.body.dueDay).toBe(1);
    expect(res.body.isActive).toBe(true);
  });

  it("rejects a due day outside 1-28 at the database", async () => {
    const res = await request(app)
      .post(plans(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Bad Due Day", monthlyRent: 5000, dueDay: 29 });

    // Caught by the zod schema before it ever reaches the CHECK constraint.
    expect(res.status).toBe(400);
  });

  it("rejects a due day of 0", async () => {
    const res = await request(app)
      .post(plans(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Zero Due Day", monthlyRent: 5000, dueDay: 0 });

    expect(res.status).toBe(400);
  });

  it("accepts the due day boundaries", async () => {
    const low = await request(app)
      .post(plans(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Due First", monthlyRent: 5000, dueDay: 1 });
    expect(low.status).toBe(201);

    const high = await request(app)
      .post(plans(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Due Twenty-Eighth", monthlyRent: 5000, dueDay: 28 });
    expect(high.status).toBe(201);
  });

  it("rejects a duplicate plan name within the property", async () => {
    const res = await request(app)
      .post(plans(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Standard", monthlyRent: 7000 });

    expect(res.status).toBe(409);
  });

  it("allows the same plan name in a different property", async () => {
    const res = await request(app)
      .post(plans(bob))
      .set("Cookie", bob.cookie)
      .send({ name: "Standard", monthlyRent: 5500 });

    expect(res.status).toBe(201);
  });

  it("hides another owner's plans", async () => {
    const list = await request(app).get(plans(bob)).set("Cookie", bob.cookie);
    expect(list.body).toHaveLength(1);

    const foreign = await request(app).get(plans(alice)).set("Cookie", bob.cookie);
    expect(foreign.status).toBe(404);
  });

  it("resolves room rent from the plan when the room has none of its own override", async () => {
    const standard = await request(app).get(plans(alice)).set("Cookie", alice.cookie);
    const planId = standard.body.find((p: { plan: { name: string } }) => p.plan.name === "Standard")
      .plan.id;

    const created = await request(app)
      .post(rooms(alice))
      .set("Cookie", alice.cookie)
      .send({ number: "101", capacity: 1, monthlyRent: 6000, rentPlanId: planId });

    expect(created.status).toBe(201);

    const tenantRes = await request(app)
      .post(`/v1/properties/${alice.propertyId}/tenants`)
      .set("Cookie", alice.cookie)
      .send({
        name: "Plan Tenant",
        phone: nextPhone(),
        roomId: created.body.id,
        joiningDate: new Date().toISOString(),
      });
    expect(tenantRes.status).toBe(201);

    const month = `2026-0${(new Date().getMonth() % 9) + 1}`;
    const generated = await request(app)
      .post(`/v1/properties/${alice.propertyId}/bills/generate`)
      .set("Cookie", alice.cookie)
      .send({ month });

    expect(generated.status).toBe(201);
    const theBill = generated.body.bills[0];
    // Plan rent (6500) wins over the room's own 6000.
    expect(theBill.rentAmount).toBe(6500);
  });

  it("refuses a room referencing a plan from another property", async () => {
    const bobPlans = await request(app).get(plans(bob)).set("Cookie", bob.cookie);

    const res = await request(app)
      .post(rooms(alice))
      .set("Cookie", alice.cookie)
      .send({
        number: "902",
        capacity: 1,
        monthlyRent: 5000,
        rentPlanId: bobPlans.body[0].plan.id,
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Rent plan not found");
  });

  it("refuses to delete a plan still assigned to a room", async () => {
    const list = await request(app).get(plans(alice)).set("Cookie", alice.cookie);
    const used = list.body.find(
      (p: { plan: { name: string }; roomCount: number }) => p.plan.name === "Standard",
    );
    expect(used.roomCount).toBeGreaterThan(0);

    const res = await request(app)
      .delete(plans(alice, `/${used.plan.id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(409);
  });

  it("deactivates a plan without changing a bill already issued", async () => {
    const list = await request(app).get(plans(alice)).set("Cookie", alice.cookie);
    const standard = list.body.find(
      (p: { plan: { name: string } }) => p.plan.name === "Standard",
    ).plan;

    const before = await db
      .select({ rentAmount: bill.rentAmount })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(eq(tenant.propertyId, alice.propertyId));
    const originalAmount = before[0]!.rentAmount;

    const deactivate = await request(app)
      .put(plans(alice, `/${standard.id}`))
      .set("Cookie", alice.cookie)
      .send({ isActive: false, monthlyRent: 99999 });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.isActive).toBe(false);

    const after = await db
      .select({ rentAmount: bill.rentAmount })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(eq(tenant.propertyId, alice.propertyId));

    expect(after[0]!.rentAmount).toBe(originalAmount);
  });

  it("deletes an unused plan", async () => {
    const list = await request(app).get(plans(alice)).set("Cookie", alice.cookie);
    const unused = list.body.find(
      (p: { plan: { name: string } }) => p.plan.name === "Due First",
    ).plan;

    const res = await request(app)
      .delete(plans(alice, `/${unused.id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
  });
});
