import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { eq, and, inArray } from "drizzle-orm";
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
  advancePayment,
  advanceApplication,
  electricityReading,
  billAdjustment,
} from "@pgkhata/db";
import { app } from "../index";
import { registerVerifiedUser } from "./db-auth-helper";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

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
  const email = `moneyfix-${label}-${suffix}@pgkhata.test`;
  const { userId, cookie } = await registerVerifiedUser(app, {
    name: `Money Fix ${label}`,
    email,
    password: "moneyfix-password-123",
  });
  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Money Fix PG ${label} ${suffix}`, electricityRatePerUnit: 10 });
  return { userId, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  const rooms = await db.select({ id: room.id }).from(room).where(eq(room.propertyId, owner.propertyId));
  const roomIds = rooms.map((r) => r.id);
  const tenants = await db.select({ id: tenant.id }).from(tenant).where(eq(tenant.propertyId, owner.propertyId));
  const tenantIds = tenants.map((t) => t.id);

  if (tenantIds.length > 0) {
    await db.delete(advanceApplication).where(inArray(advanceApplication.tenantId, tenantIds));
    for (const t of tenants) {
      const tenantBills = await db.select({ id: bill.id }).from(bill).where(eq(bill.tenantId, t.id));
      for (const b of tenantBills) await db.delete(payment).where(eq(payment.billId, b.id));
      await db.delete(bill).where(eq(bill.tenantId, t.id));
    }
    await db.delete(advancePayment).where(inArray(advancePayment.tenantId, tenantIds));
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
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;

describeDb("money-logic fixes (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
  }, 30000);

  afterAll(async () => {
    await teardown(alice);
  });

  const base = (p = "") => `/v1/properties/${alice.propertyId}${p}`;

  async function addAndApproveTenant(body: object) {
    const created = await request(app).post(base("/tenants")).set("Cookie", alice.cookie).send(body);
    if (created.status !== 201) throw new Error(`tenant create failed ${created.status}`);
    await request(app).post(base(`/tenants/${created.body.id}/approve`)).set("Cookie", alice.cookie);
    return created.body.id as string;
  }

  it("regenerating a bill after a late fee preserves the LATE line (does not refund it)", async () => {
    const planId = (
      await request(app)
        .post(base("/rent-plans"))
        .set("Cookie", alice.cookie)
        .send({ name: "Regen Plan", monthlyRent: 6000, dueDay: 5, lateFeePerDay: 50 })
    ).body.id;

    const roomId = (
      await request(app)
        .post(base("/rooms"))
        .set("Cookie", alice.cookie)
        .send({ number: "R101", capacity: 1, monthlyRent: 6000, rentPlanId: planId })
    ).body.id;

    await addAndApproveTenant({
      name: "Regen Tenant",
      phone: nextPhone(),
      roomId,
      joiningDate: "2026-05-01T00:00:00.000Z",
    });

    // Two readings → 100 units → ₹1000 electricity on top of ₹6000 rent.
    await request(app).post(base("/readings")).set("Cookie", alice.cookie)
      .send({ roomId, reading: 100, readingDate: "2026-06-01T00:00:00.000Z" });
    await request(app).post(base("/readings")).set("Cookie", alice.cookie)
      .send({ roomId, reading: 200, readingDate: "2026-06-30T00:00:00.000Z" });

    const gen = await request(app).post(base("/bills/generate")).set("Cookie", alice.cookie).send({ month: "2026-06" });
    const billId: string = gen.body.bills[0].id;
    expect(gen.body.bills[0].totalAmount).toBe(7000);

    await db.update(bill).set({ dueDate: new Date("2026-06-05T00:00:00.000Z") }).where(eq(bill.id, billId));

    // Apply a late fee: +₹250 (5 days * ₹50).
    await request(app).post(base("/bills/apply-late-fees")).set("Cookie", alice.cookie)
      .send({ billIds: [billId], asOf: "2026-06-10T00:00:00.000Z" });

    let [b] = await db.select().from(bill).where(eq(bill.id, billId));
    expect(b!.totalAmount).toBe(7250);
    expect((b!.lineItems as { code: string }[]).some((l) => l.code === "LATE")).toBe(true);

    // Force an electricity change so regeneration hits the reconcile path:
    // bump the closing reading 200 -> 300 (units 100 -> 200, ₹1000 -> ₹2000).
    await db.update(electricityReading)
      .set({ reading: 300 })
      .where(and(eq(electricityReading.roomId, roomId), eq(electricityReading.readingDate, new Date("2026-06-30T00:00:00.000Z"))));

    const regen = await request(app).post(base("/bills/generate")).set("Cookie", alice.cookie).send({ month: "2026-06" });
    expect(regen.status).toBe(201);

    [b] = await db.select().from(bill).where(eq(bill.id, billId));
    const lateLines = (b!.lineItems as { code: string; amount: number }[]).filter((l) => l.code === "LATE");
    // The bug: regeneration rebuilt lineItems from rent+electricity only and
    // dropped the LATE line. The fix preserves it.
    expect(lateLines).toHaveLength(1);
    expect(lateLines[0]!.amount).toBe(250);
    expect(b!.electricityAmount).toBe(2000); // electricity did get reconciled
    expect(b!.totalAmount).toBe(8250); // 6000 rent + 2000 elec + 250 late
    expect(b!.balance).toBe(8250);

    // And the reconciliation is auditable.
    const adjustments = await db.select().from(billAdjustment).where(eq(billAdjustment.billId, billId));
    expect(adjustments.length).toBeGreaterThanOrEqual(1);
  });

  it("deleting an advance-funded payment restores the advance's available balance", async () => {
    const roomId = (
      await request(app)
        .post(base("/rooms"))
        .set("Cookie", alice.cookie)
        .send({ number: "R202", capacity: 1, monthlyRent: 5000 })
    ).body.id;

    const tenantId = await addAndApproveTenant({
      name: "Advance Tenant",
      phone: nextPhone(),
      roomId,
      joiningDate: "2026-05-01T00:00:00.000Z",
    });

    const gen = await request(app).post(base("/bills/generate")).set("Cookie", alice.cookie).send({ month: "2026-05" });
    // /generate bills every active tenant for the month, so select this test's
    // own tenant rather than assuming a position.
    const myBill = gen.body.bills.find((b: { tenantId: string }) => b.tenantId === tenantId);
    const billId: string = myBill.id;
    expect(myBill.totalAmount).toBe(5000);

    // Create a ₹5000 advance and apply the full amount to the bill.
    const advance = await request(app).post(base("/advance-payments")).set("Cookie", alice.cookie)
      .send({ tenantId, amount: 5000 });
    const advanceId: string = advance.body.id;

    const applied = await request(app).post(base(`/advance-payments/${advanceId}/apply`)).set("Cookie", alice.cookie)
      .send({ billId, amount: 5000 });
    expect(applied.status).toBe(200);

    let [adv] = await db.select().from(advancePayment).where(eq(advancePayment.id, advanceId));
    expect(adv!.appliedAmount).toBe(5000);
    expect(adv!.status).toBe("applied");

    // Find the advance-funded payment and delete it.
    const [advPayment] = await db.select().from(payment)
      .where(and(eq(payment.billId, billId), eq(payment.method, "advance"))).limit(1);
    expect(advPayment).toBeDefined();

    const del = await request(app).delete(base(`/payments/${advPayment!.id}`)).set("Cookie", alice.cookie);
    expect(del.status).toBe(200);

    // The advance's applied balance must be restored, not stranded.
    [adv] = await db.select().from(advancePayment).where(eq(advancePayment.id, advanceId));
    expect(adv!.appliedAmount).toBe(0);
    expect(adv!.status).toBe("available");

    // The bill goes back to unpaid, and the application link is gone.
    const [b] = await db.select().from(bill).where(eq(bill.id, billId));
    expect(b!.paidAmount).toBe(0);
    expect(b!.balance).toBe(5000);
    const apps = await db.select().from(advanceApplication).where(eq(advanceApplication.advanceId, advanceId));
    expect(apps).toHaveLength(0);
  });
});
