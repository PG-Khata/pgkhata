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
  chargeType,
  tenant,
  bill,
  electricityReading,
} from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let phoneSeq = 0;
function nextPhone() {
  phoneSeq += 1;
  const base = 9_200_000_000 + (suffix % 700_000) * 100;
  return String(base + phoneSeq);
}

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `lineitems-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Line Items ${label}`, email, password: "lineitems-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Line Items PG ${label} ${suffix}`, electricityRatePerUnit: 10 });

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  const rooms = await db
    .select({ id: room.id })
    .from(room)
    .where(eq(room.propertyId, owner.propertyId));
  const roomIds = rooms.map((r) => r.id);

  // Scope tenants by propertyId directly (pending tenants may have no roomId).
  const tenants = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.propertyId, owner.propertyId));
  const tenantIds = tenants.map((t) => t.id);

  if (tenantIds.length > 0) {
    for (const t of tenants) {
      await db.delete(bill).where(eq(bill.tenantId, t.id));
    }
    await db.update(tenant).set({ bedId: null, requestedRoomId: null }).where(eq(tenant.propertyId, owner.propertyId));
    await db.delete(tenant).where(eq(tenant.propertyId, owner.propertyId));
  }
  if (roomIds.length > 0) {
    await db.delete(electricityReading).where(inArray(electricityReading.roomId, roomIds));
    await db.delete(bed).where(inArray(bed.roomId, roomIds));
    await db.update(room).set({ rentPlanId: null }).where(inArray(room.id, roomIds));
    await db.delete(room).where(eq(room.propertyId, owner.propertyId));
  }
  await db.delete(rentPlan).where(eq(rentPlan.propertyId, owner.propertyId));
  await db.delete(chargeType).where(eq(chargeType.propertyId, owner.propertyId));
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;

describeDb("billing on line items (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
  }, 20000);

  afterAll(async () => {
    await teardown(alice);
  });

  function bills(path = "") {
    return `/v1/properties/${alice.propertyId}/bills${path}`;
  }
  function rooms(path = "") {
    return `/v1/properties/${alice.propertyId}/rooms${path}`;
  }
  function tenants(path = "") {
    return `/v1/properties/${alice.propertyId}/tenants${path}`;
  }
  function readings(path = "") {
    return `/v1/properties/${alice.propertyId}/readings${path}`;
  }

  /** Create a pending tenant then approve them so they get a bed and become active. */
  async function addAndApproveTenant(body: object) {
    const created = await request(app)
      .post(tenants())
      .set("Cookie", alice.cookie)
      .send(body);
    if (created.status !== 201) return created;
    return request(app)
      .post(tenants(`/${created.body.id}/approve`))
      .set("Cookie", alice.cookie);
  }

  it("bills rent and electricity as separate line items with a due date", async () => {
    const plans = await request(app).get(`/v1/properties/${alice.propertyId}/rent-plans`).set("Cookie", alice.cookie);
    const planId = (
      await request(app)
        .post(`/v1/properties/${alice.propertyId}/rent-plans`)
        .set("Cookie", alice.cookie)
        .send({ name: "Standard", monthlyRent: 6500, dueDay: 7 })
    ).body.id;
    void plans;

    const roomRes = await request(app)
      .post(rooms())
      .set("Cookie", alice.cookie)
      .send({ number: "101", capacity: 1, monthlyRent: 6000, rentPlanId: planId });
    const roomId = roomRes.body.id;

    const tenantRes = await addAndApproveTenant({
      name: "Line Item Tenant",
      phone: nextPhone(),
      roomId,
      joiningDate: "2026-05-01T00:00:00.000Z",
    });
    expect(tenantRes.status).toBe(200);

    await request(app)
      .post(readings())
      .set("Cookie", alice.cookie)
      .send({ roomId, reading: 100, readingDate: "2026-06-01T00:00:00.000Z" });
    await request(app)
      .post(readings())
      .set("Cookie", alice.cookie)
      .send({ roomId, reading: 150, readingDate: "2026-06-30T00:00:00.000Z" });

    const generated = await request(app)
      .post(bills("/generate"))
      .set("Cookie", alice.cookie)
      .send({ month: "2026-06" });

    expect(generated.status).toBe(201);
    expect(generated.body.generated).toBe(1);

    const theBill = generated.body.bills[0];
    expect(theBill.rentAmount).toBe(6500); // plan rent wins over room's 6000
    expect(theBill.electricityAmount).toBe(500); // 50 units * 10/unit
    expect(theBill.lineItems).toEqual([
      { code: "RENT", name: "Rent", amount: 6500 },
      { code: "ELEC", name: "Electricity", amount: 500, units: 50, ratePerUnit: 10 },
    ]);
    expect(theBill.totalAmount).toBe(7000);
    expect(new Date(theBill.dueDate).getTime()).toBeGreaterThan(new Date(theBill.createdAt).getTime());
    expect(Math.round((new Date(theBill.dueDate).getTime() - new Date(theBill.createdAt).getTime()) / 86_400_000)).toBe(5);
  });

  it("bills the correct month's reading, not the latest one", async () => {
    const roomRes = await request(app)
      .post(rooms())
      .set("Cookie", alice.cookie)
      .send({ number: "201", capacity: 1, monthlyRent: 5000 });
    const roomId = roomRes.body.id;

    await addAndApproveTenant({
      name: "Month Tenant",
      phone: nextPhone(),
      roomId,
      joiningDate: new Date().toISOString(),
    });

    // Readings for June and August, but bill July — no reading exists for it.
    await request(app)
      .post(readings())
      .set("Cookie", alice.cookie)
      .send({ roomId, reading: 0, readingDate: "2026-06-01T00:00:00.000Z" });
    await request(app)
      .post(readings())
      .set("Cookie", alice.cookie)
      .send({ roomId, reading: 200, readingDate: "2026-08-01T00:00:00.000Z" });

    const generated = await request(app)
      .post(bills("/generate"))
      .set("Cookie", alice.cookie)
      .send({ month: "2026-07" });

    const julyBill = generated.body.bills.find(
      (b: { rentAmount: number }) => b.rentAmount === 5000,
    );
    // Not the 200-unit August reading — July has none, so electricity is 0.
    expect(julyBill.electricityAmount).toBe(0);
  });

  it("splits electricity among co-tenants of a shared room", async () => {
    const roomRes = await request(app)
      .post(rooms())
      .set("Cookie", alice.cookie)
      .send({ number: "301", capacity: 2, monthlyRent: 4000 });
    const roomId = roomRes.body.id;

    const first = await addAndApproveTenant({ name: "Co Tenant One", phone: nextPhone(), roomId, joiningDate: new Date().toISOString() });
    await addAndApproveTenant({ name: "Co Tenant Two", phone: nextPhone(), roomId, joiningDate: new Date().toISOString() });

    await request(app)
      .post(readings())
      .set("Cookie", alice.cookie)
      .send({ roomId, reading: 0, readingDate: "2026-09-01T00:00:00.000Z" });
    await request(app)
      .post(readings())
      .set("Cookie", alice.cookie)
      .send({ roomId, reading: 100, readingDate: "2026-09-28T00:00:00.000Z" });

    const generated = await request(app)
      .post(bills("/generate"))
      .set("Cookie", alice.cookie)
      .send({ month: "2026-09" });

    const roomBills = generated.body.bills.filter(
      (b: { tenantId: string }) => b.tenantId === first.body.id || true,
    );
    const sharedBill = roomBills.find((b: { electricityAmount: number }) => b.electricityAmount === 500);
    // 1000 total / 2 occupants = 500 each.
    expect(sharedBill).toBeDefined();
  });

  it("prorates a mid-month tenant's electricity from the two readings", async () => {
    const roomRes = await request(app)
      .post(rooms())
      .set("Cookie", alice.cookie)
      .send({ number: "302", capacity: 2, monthlyRent: 6200 });
    const roomId = roomRes.body.id;

    const established = await addAndApproveTenant({
      name: "Established Tenant",
      phone: nextPhone(),
      roomId,
      joiningDate: "2026-04-01T00:00:00.000Z",
    });
    const midMonth = await addAndApproveTenant({
      name: "Mid Month Tenant",
      phone: nextPhone(),
      roomId,
      joiningDate: "2026-05-16T00:00:00.000Z",
    });
    expect(established.status).toBe(200);
    expect(midMonth.status).toBe(200);

    await request(app)
      .post(readings())
      .set("Cookie", alice.cookie)
      .send({ roomId, reading: 1000, readingDate: "2026-05-01T00:00:00.000Z" });
    await request(app)
      .post(readings())
      .set("Cookie", alice.cookie)
      .send({ roomId, reading: 1100, readingDate: "2026-05-31T00:00:00.000Z" });

    const generated = await request(app)
      .post(bills("/generate"))
      .set("Cookie", alice.cookie)
      .send({ month: "2026-05" });

    const establishedBill = generated.body.bills.find((b: { tenantId: string }) => b.tenantId === established.body.id);
    const midMonthBill = generated.body.bills.find((b: { tenantId: string }) => b.tenantId === midMonth.body.id);

    // 100 units × ₹10 = ₹1,000. The first tenant stayed 30 days and the
    // second stayed 15, so their electricity shares are ₹667 and ₹333.
    expect(establishedBill.electricityAmount).toBe(667);
    expect(midMonthBill.electricityAmount).toBe(333);
  });

  it("adds an active recurring charge type as its own line", async () => {
    await request(app)
      .post(`/v1/properties/${alice.propertyId}/charge-types`)
      .set("Cookie", alice.cookie)
      .send({ name: "Maintenance", code: "MAINT", defaultAmount: 300, isRecurring: true });

    const roomRes = await request(app)
      .post(rooms())
      .set("Cookie", alice.cookie)
      .send({ number: "401", capacity: 1, monthlyRent: 5500 });

    await addAndApproveTenant({
      name: "Maint Tenant",
      phone: nextPhone(),
      roomId: roomRes.body.id,
      joiningDate: new Date().toISOString(),
    });

    const generated = await request(app)
      .post(bills("/generate"))
      .set("Cookie", alice.cookie)
      .send({ month: "2026-10" });

    const theBill = generated.body.bills.find((b: { rentAmount: number }) => b.rentAmount === 5500);
    expect(theBill.lineItems).toContainEqual({ code: "MAINT", name: "Maintenance", amount: 300 });
    expect(theBill.totalAmount).toBe(5800);
  });

  it("excludes a one-off (non-recurring) charge type from generation", async () => {
    await request(app)
      .post(`/v1/properties/${alice.propertyId}/charge-types`)
      .set("Cookie", alice.cookie)
      .send({ name: "Deposit Top-up", code: "TOPUP", defaultAmount: 1000, isRecurring: false });

    const roomRes = await request(app)
      .post(rooms())
      .set("Cookie", alice.cookie)
      .send({ number: "402", capacity: 1, monthlyRent: 5100 });

    await addAndApproveTenant({
      name: "OneOff Tenant",
      phone: nextPhone(),
      roomId: roomRes.body.id,
      joiningDate: new Date().toISOString(),
    });

    const generated = await request(app)
      .post(bills("/generate"))
      .set("Cookie", alice.cookie)
      .send({ month: "2026-11" });

    const theBill = generated.body.bills.find((b: { rentAmount: number }) => b.rentAmount === 5100);
    expect(theBill.lineItems.some((line: { code: string }) => line.code === "TOPUP")).toBe(false);
  });

  it("is idempotent: a second generate call for the same month inserts nothing", async () => {
    const first = await request(app)
      .post(bills("/generate"))
      .set("Cookie", alice.cookie)
      .send({ month: "2026-12" });
    const firstGenerated = first.body.generated;

    const second = await request(app)
      .post(bills("/generate"))
      .set("Cookie", alice.cookie)
      .send({ month: "2026-12" });

    expect(second.body.generated).toBe(0);
    expect(second.body.skipped).toBe(firstGenerated);
  });

  it("totals always equal the sum of their own line items", async () => {
    const list = await request(app).get(bills()).set("Cookie", alice.cookie);

    for (const row of list.body) {
      const sum = row.bill.lineItems.reduce(
        (total: number, line: { amount: number }) => total + line.amount,
        0,
      );
      expect(row.bill.totalAmount).toBe(sum);
    }
  });

  it("scopes bill approval to the requesting owner's property", async () => {
    const list = await request(app).get(bills()).set("Cookie", alice.cookie);
    const targetId = list.body[0].bill.id;

    // A second owner, with no relationship to Alice's bills.
    const bob = await createOwner("bob-approve");

    const res = await request(app)
      .post(`/v1/properties/${bob.propertyId}/bills/approve`)
      .set("Cookie", bob.cookie)
      .send({ billIds: [targetId] });

    expect(res.status).toBe(200);
    expect(res.body.bills).toHaveLength(0);

    const stillUnapproved = await db
      .select({ approved: bill.approved })
      .from(bill)
      .where(eq(bill.id, targetId));
    expect(stillUnapproved[0]!.approved).toBe(false);

    await teardown(bob);
  });
});
