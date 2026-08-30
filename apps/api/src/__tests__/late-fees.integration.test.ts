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
  payment,
} from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let phoneSeq = 0;
function nextPhone() {
  phoneSeq += 1;
  const base = 9_300_000_000 + (suffix % 600_000) * 100;
  return String(base + phoneSeq);
}

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `latefee-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Late Fee ${label}`, email, password: "latefee-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Late Fee PG ${label} ${suffix}` });

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
      const tenantBills = await db.select({ id: bill.id }).from(bill).where(eq(bill.tenantId, t.id));
      for (const b of tenantBills) {
        await db.delete(payment).where(eq(payment.billId, b.id));
      }
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
let planId: string;
let roomId: string;
let billId: string;

describeDb("late fees (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");

    planId = (
      await request(app)
        .post(`/v1/properties/${alice.propertyId}/rent-plans`)
        .set("Cookie", alice.cookie)
        .send({ name: "Standard", monthlyRent: 6000, dueDay: 5, lateFeePerDay: 50 })
    ).body.id;

    roomId = (
      await request(app)
        .post(`/v1/properties/${alice.propertyId}/rooms`)
        .set("Cookie", alice.cookie)
        .send({ number: "101", capacity: 1, monthlyRent: 6000, rentPlanId: planId })
    ).body.id;

    await request(app)
      .post(`/v1/properties/${alice.propertyId}/tenants`)
      .set("Cookie", alice.cookie)
      .send({
        name: "Late Fee Tenant",
        phone: nextPhone(),
        roomId,
        joiningDate: new Date().toISOString(),
      });

    const generated = await request(app)
      .post(`/v1/properties/${alice.propertyId}/bills/generate`)
      .set("Cookie", alice.cookie)
      .send({ month: "2026-06" });
    billId = generated.body.bills[0].id;
  }, 20000);

  afterAll(async () => {
    await teardown(alice);
  });

  function applyLateFees(body: object) {
    return request(app)
      .post(`/v1/properties/${alice.propertyId}/bills/apply-late-fees`)
      .set("Cookie", alice.cookie)
      .send(body);
  }

  it("adds no late fee before the due date", async () => {
    const res = await applyLateFees({ billIds: [billId], asOf: "2026-06-03T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(0);

    const [b] = await db.select().from(bill).where(eq(bill.id, billId));
    expect((b!.lineItems as { code: string }[]).some((l) => l.code === "LATE")).toBe(false);
  });

  it("adds a LATE line item once overdue", async () => {
    const res = await applyLateFees({ billIds: [billId], asOf: "2026-06-10T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);

    const [b] = await db.select().from(bill).where(eq(bill.id, billId));
    const lateLine = (b!.lineItems as { code: string; amount: number }[]).find(
      (l) => l.code === "LATE",
    );
    // due 6/5, asOf 6/10 -> 5 days * 50/day = 250
    expect(lateLine?.amount).toBe(250);
    expect(b!.totalAmount).toBe(6250);
    expect(b!.balance).toBe(6250);
  });

  it("is idempotent: re-running the same day updates rather than stacking", async () => {
    await applyLateFees({ billIds: [billId], asOf: "2026-06-10T00:00:00.000Z" });
    const res = await applyLateFees({ billIds: [billId], asOf: "2026-06-10T00:00:00.000Z" });

    expect(res.status).toBe(200);

    const [b] = await db.select().from(bill).where(eq(bill.id, billId));
    const lateLines = (b!.lineItems as { code: string }[]).filter((l) => l.code === "LATE");
    expect(lateLines).toHaveLength(1);
    expect(b!.totalAmount).toBe(6250);
  });

  it("increases the fee on a later run without duplicating the line", async () => {
    const res = await applyLateFees({ billIds: [billId], asOf: "2026-06-15T00:00:00.000Z" });

    expect(res.status).toBe(200);

    const [b] = await db.select().from(bill).where(eq(bill.id, billId));
    const lateLines = (b!.lineItems as { code: string; amount: number }[]).filter(
      (l) => l.code === "LATE",
    );
    expect(lateLines).toHaveLength(1);
    // 10 days overdue now.
    expect(lateLines[0]!.amount).toBe(500);
    expect(b!.totalAmount).toBe(6500);
  });

  it("charges nothing once the bill is fully paid, and removes a stale LATE line", async () => {
    await request(app)
      .post(`/v1/properties/${alice.propertyId}/payments`)
      .set("Cookie", alice.cookie)
      .send({ billId, amount: 6500, paymentDate: "2026-06-16T00:00:00.000Z", method: "cash" });

    const res = await applyLateFees({ billIds: [billId], asOf: "2026-06-20T00:00:00.000Z" });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1); // the stale LATE line was removed

    const [b] = await db.select().from(bill).where(eq(bill.id, billId));
    expect((b!.lineItems as { code: string }[]).some((l) => l.code === "LATE")).toBe(false);
    expect(b!.totalAmount).toBe(6000);
    expect(b!.balance).toBe(0);
  });

  it("applies to every overdue bill in the property when no billIds are given", async () => {
    const secondRoom = (
      await request(app)
        .post(`/v1/properties/${alice.propertyId}/rooms`)
        .set("Cookie", alice.cookie)
        .send({ number: "201", capacity: 1, monthlyRent: 5000, rentPlanId: planId })
    ).body.id;

    await request(app)
      .post(`/v1/properties/${alice.propertyId}/tenants`)
      .set("Cookie", alice.cookie)
      .send({
        name: "Second Tenant",
        phone: nextPhone(),
        roomId: secondRoom,
        joiningDate: new Date().toISOString(),
      });

    await request(app)
      .post(`/v1/properties/${alice.propertyId}/bills/generate`)
      .set("Cookie", alice.cookie)
      .send({ month: "2026-07" });

    const res = await applyLateFees({ asOf: "2026-07-12T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBeGreaterThanOrEqual(1);
  });

  it("charges nothing for a room with no rent plan and therefore no late fee rate", async () => {
    const roomWithoutPlan = (
      await request(app)
        .post(`/v1/properties/${alice.propertyId}/rooms`)
        .set("Cookie", alice.cookie)
        .send({ number: "301", capacity: 1, monthlyRent: 4000 })
    ).body.id;

    await request(app)
      .post(`/v1/properties/${alice.propertyId}/tenants`)
      .set("Cookie", alice.cookie)
      .send({
        name: "No Plan Tenant",
        phone: nextPhone(),
        roomId: roomWithoutPlan,
        joiningDate: new Date().toISOString(),
      });

    const generated = await request(app)
      .post(`/v1/properties/${alice.propertyId}/bills/generate`)
      .set("Cookie", alice.cookie)
      .send({ month: "2026-08" });
    const noPlanBillId = generated.body.bills.find(
      (b: { rentAmount: number }) => b.rentAmount === 4000,
    ).id;

    const res = await applyLateFees({
      billIds: [noPlanBillId],
      asOf: "2026-08-20T00:00:00.000Z",
    });

    expect(res.body.updated).toBe(0);
  });

  it("refuses a bill belonging to another owner", async () => {
    const bob = await createOwner("bob");

    const res = await applyLateFees({ billIds: [] }); // sanity: alice's own call
    expect(res.status).toBe(200);

    const foreign = await request(app)
      .post(`/v1/properties/${bob.propertyId}/bills/apply-late-fees`)
      .set("Cookie", bob.cookie)
      .send({ billIds: [billId] });

    // Scoped to Bob's own tenants; Alice's bill is not among them.
    expect(foreign.status).toBe(200);
    expect(foreign.body.updated).toBe(0);

    await teardown(bob);
  });
});
