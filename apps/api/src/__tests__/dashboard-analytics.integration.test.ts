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
  expense,
  expenseCategory,
} from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let phoneSeq = 0;
function nextPhone() {
  phoneSeq += 1;
  const base = 9_800_000_000 + (suffix % 400_000) * 100;
  return String(base + phoneSeq);
}

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `dash-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Dash ${label}`, email, password: "dashboard-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Dash PG ${label} ${suffix}` });

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  await db.delete(expense).where(eq(expense.propertyId, owner.propertyId));
  await db.delete(expenseCategory).where(eq(expenseCategory.propertyId, owner.propertyId));

  const tenants = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.propertyId, owner.propertyId));
  const tenantIds = tenants.map((t) => t.id);

  if (tenantIds.length > 0) {
    const bills = await db.select({ id: bill.id }).from(bill).where(inArray(bill.tenantId, tenantIds));
    const billIds = bills.map((b) => b.id);
    if (billIds.length > 0) {
      await db.delete(payment).where(inArray(payment.billId, billIds));
    }
    await db.delete(bill).where(inArray(bill.tenantId, tenantIds));
    await db.update(tenant).set({ bedId: null }).where(inArray(tenant.id, tenantIds));
    await db.delete(tenant).where(inArray(tenant.id, tenantIds));
  }

  const rooms = await db.select({ id: room.id }).from(room).where(eq(room.propertyId, owner.propertyId));
  const roomIds = rooms.map((r) => r.id);
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

describeDb("dashboard analytics (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");
  }, 20000);

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function url(owner: Owner, path: string) {
    return `/v1/dashboard/property/${owner.propertyId}${path}`;
  }

  it("requires authentication", async () => {
    const res = await request(app).get(url(alice, "/monthly-trend"));
    expect(res.status).toBe(401);
  });

  it("returns 6 months of trend data with zeroes for months with no activity", async () => {
    const res = await request(app).get(url(alice, "/monthly-trend")).set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body[5].month).toBe(new Date().toISOString().slice(0, 7));
    expect(res.body.every((m: { collected: number }) => m.collected === 0)).toBe(true);
  });

  it("returns an empty due-rent list when nothing is owed", async () => {
    const res = await request(app).get(url(alice, "/due-rent")).set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns an all-zero aging report when nothing is outstanding", async () => {
    const res = await request(app)
      .get(url(alice, "/outstanding-payment"))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.buckets).toHaveLength(5);
  });

  it("lists a tenant with an outstanding bill in due-rent, sorted most overdue first", async () => {
    const roomRes = await request(app)
      .post(`/v1/properties/${alice.propertyId}/rooms`)
      .set("Cookie", alice.cookie)
      .send({ number: "601", capacity: 1, monthlyRent: 5000 });

    const tenantRes = await request(app)
      .post(`/v1/properties/${alice.propertyId}/tenants`)
      .set("Cookie", alice.cookie)
      .send({
        name: "Overdue Tenant",
        phone: nextPhone(),
        roomId: roomRes.body.id,
        joiningDate: new Date().toISOString(),
      });

    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 45);

    const [insertedBill] = await db
      .insert(bill)
      .values({
        tenantId: tenantRes.body.id,
        billMonth: new Date().toISOString().slice(0, 7),
        rentAmount: 5000,
        totalAmount: 5000,
        balance: 5000,
        dueDate: pastDue,
      })
      .returning();

    const dueRent = await request(app).get(url(alice, "/due-rent")).set("Cookie", alice.cookie);
    expect(dueRent.status).toBe(200);
    expect(dueRent.body).toHaveLength(1);
    expect(dueRent.body[0].tenantName).toBe("Overdue Tenant");
    expect(dueRent.body[0].amountDue).toBe(5000);
    expect(dueRent.body[0].daysOverdue).toBeGreaterThanOrEqual(44);

    const aging = await request(app)
      .get(url(alice, "/outstanding-payment"))
      .set("Cookie", alice.cookie);
    expect(aging.status).toBe(200);
    expect(aging.body.total).toBe(5000);
    const bucket31to60 = aging.body.buckets.find((b: { bucket: string }) => b.bucket === "31-60");
    expect(bucket31to60.total).toBe(5000);

    // Cross-owner isolation: Bob's property sees none of this.
    const bobDueRent = await request(app).get(url(bob, "/due-rent")).set("Cookie", bob.cookie);
    expect(bobDueRent.body).toEqual([]);

    // Clean up the manually inserted bill so afterAll's teardown (which
    // expects to delete via tenant/property scoping) still finds it.
    await db.delete(bill).where(eq(bill.id, insertedBill!.id));
  });

  it("reflects approved expenses and collected payments in the monthly trend", async () => {
    const category = await request(app)
      .post(`/v1/properties/${alice.propertyId}/expenses/categories`)
      .set("Cookie", alice.cookie)
      .send({ name: "Trend Category" });

    const createdExpense = await request(app)
      .post(`/v1/properties/${alice.propertyId}/expenses`)
      .set("Cookie", alice.cookie)
      .send({ categoryId: category.body.id, amount: 1200, description: "Trend expense" });

    await request(app)
      .post(`/v1/properties/${alice.propertyId}/expenses/${createdExpense.body.id}/approve`)
      .set("Cookie", alice.cookie);

    const trend = await request(app).get(url(alice, "/monthly-trend")).set("Cookie", alice.cookie);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonth = trend.body.find((m: { month: string }) => m.month === currentMonth);

    expect(thisMonth.expenses).toBe(1200);
  });
});
