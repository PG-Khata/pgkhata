import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { app } from "../index";
import { bill, db, ownerProfile, payment, property, tenant, user } from "@pgkhata/db";
import { registerVerifiedUser } from "./db-auth-helper";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const suffix = Date.now();
let cookie: string[];
let userId: string;
let propertyId: string;
let tenantId: string;
const tenantIds: string[] = [];
const billIds: string[] = [];

describeDb("payment safety and soft void (database)", () => {
  beforeAll(async () => {
    const email = `payment-safety-${suffix}@pgkhata.test`;
    const registered = await registerVerifiedUser(app, {
      name: "Payment Safety", email, password: "payment-safety-123",
    });
    cookie = registered.cookie;
    userId = registered.userId;

    const createdProperty = await request(app).post("/v1/properties").set("Cookie", cookie)
      .send({ name: `Payment Safety ${suffix}` });
    propertyId = createdProperty.body.id;
    const [createdTenant] = await db.insert(tenant).values({
      propertyId,
      name: "Payment Tenant",
      phone: `8${String(suffix).slice(-9)}`,
      joiningDate: new Date("2026-01-01T00:00:00.000Z"),
      status: "active",
    }).returning({ id: tenant.id });
    tenantId = createdTenant!.id;
    tenantIds.push(tenantId);
  });

  afterAll(async () => {
    if (billIds.length) await db.delete(payment).where(inArray(payment.billId, billIds));
    if (billIds.length) await db.delete(bill).where(inArray(bill.id, billIds));
    await db.delete(tenant).where(inArray(tenant.id, tenantIds));
    await db.delete(property).where(eq(property.id, propertyId));
    await db.delete(ownerProfile).where(eq(ownerProfile.userId, userId));
    await db.delete(user).where(eq(user.id, userId));
  });

  async function makeBill(total = 1000) {
    const revision = billIds.length + 1;
    const [created] = await db.insert(bill).values({
      tenantId,
      billMonth: "2099-01",
      revision,
      rentAmount: total,
      electricityAmount: 0,
      lineItems: [{ code: "RENT", name: "Rent", amount: total }],
      totalAmount: total,
      balance: total,
      dueDate: new Date("2099-01-05T00:00:00.000Z"),
    }).returning();
    billIds.push(created!.id);
    return created!;
  }

  function paymentsUrl() {
    return `/v1/properties/${propertyId}/payments`;
  }

  function payload(billId: string, amount: number, idempotencyKey?: string) {
    return { billId, amount, paymentDate: "2026-09-08", method: "cash", idempotencyKey };
  }

  it("rejects a keyless request without changing the ledger", async () => {
    const target = await makeBill();
    const response = await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 100));
    expect(response.status).toBe(400);
    expect(await db.select().from(payment).where(eq(payment.billId, target.id))).toHaveLength(0);
  });

  it("returns the original result for the same key and payload", async () => {
    const target = await makeBill();
    const key = crypto.randomUUID();
    const first = await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 400, key));
    const retry = await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 400, key));
    expect([first.status, retry.status]).toEqual([201, 200]);
    const rows = await db.select().from(payment).where(eq(payment.billId, target.id));
    expect(rows).toHaveLength(1);
    const [storedBill] = await db.select().from(bill).where(eq(bill.id, target.id));
    expect(storedBill).toMatchObject({ paidAmount: 400, balance: 600 });
  });

  it("rejects reuse of a key with changed details", async () => {
    const target = await makeBill();
    const key = crypto.randomUUID();
    expect((await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 100, key))).status).toBe(201);
    expect((await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 101, key))).status).toBe(409);
    expect(await db.select().from(payment).where(eq(payment.billId, target.id))).toHaveLength(1);
  });

  it("rejects overpayment and accepts the exact balance", async () => {
    const target = await makeBill(500);
    expect((await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 501, crypto.randomUUID()))).status).toBe(409);
    expect((await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 500, crypto.randomUUID()))).status).toBe(201);
    const [storedBill] = await db.select().from(bill).where(eq(bill.id, target.id));
    expect(storedBill).toMatchObject({ paidAmount: 500, balance: 0, status: "paid" });
  });

  it("serializes ten concurrent full-balance submissions to one row", async () => {
    const target = await makeBill(250);
    const responses = await Promise.all(Array.from({ length: 10 }, () =>
      request(app).post(paymentsUrl()).set("Cookie", cookie)
        .send(payload(target.id, 250, crypto.randomUUID())),
    ));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(9);
    expect(await db.select().from(payment).where(eq(payment.billId, target.id))).toHaveLength(1);
  });

  it("returns one creation and nine idempotent successes for concurrent retries", async () => {
    const target = await makeBill(250);
    const key = crypto.randomUUID();
    const responses = await Promise.all(Array.from({ length: 10 }, () =>
      request(app).post(paymentsUrl()).set("Cookie", cookie)
        .send(payload(target.id, 250, key)),
    ));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(9);
    expect(await db.select().from(payment).where(eq(payment.billId, target.id))).toHaveLength(1);
  });

  it("rejects an excessive auto-allocation atomically", async () => {
    const [otherTenant] = await db.insert(tenant).values({
      propertyId,
      name: "Allocation Tenant",
      phone: `7${String(suffix).slice(-9)}`,
      joiningDate: new Date("2026-01-01T00:00:00.000Z"),
      status: "active",
    }).returning();
    tenantIds.push(otherTenant!.id);
    const createdBills = await db.insert(bill).values([
      {
        tenantId: otherTenant!.id, billMonth: "2098-01", rentAmount: 100,
        electricityAmount: 0, lineItems: [{ code: "RENT", name: "Rent", amount: 100 }],
        totalAmount: 100, balance: 100,
      },
      {
        tenantId: otherTenant!.id, billMonth: "2098-02", rentAmount: 200,
        electricityAmount: 0, lineItems: [{ code: "RENT", name: "Rent", amount: 200 }],
        totalAmount: 200, balance: 200,
      },
    ]).returning();
    billIds.push(...createdBills.map((row) => row.id));

    const response = await request(app).post(`${paymentsUrl()}/auto-allocate`)
      .set("Cookie", cookie).send({
        tenantId: otherTenant!.id,
        amount: 301,
        paymentDate: "2026-09-08",
        method: "cash",
        idempotencyKey: crypto.randomUUID(),
      });
    expect(response.status).toBe(409);
    const rows = await db.select().from(payment).where(inArray(
      payment.billId, createdBills.map((row) => row.id),
    ));
    expect(rows).toHaveLength(0);
    const stored = await db.select().from(bill).where(inArray(
      bill.id, createdBills.map((row) => row.id),
    ));
    expect(stored.map((row) => row.balance).sort((a, b) => a - b)).toEqual([100, 200]);
  });

  it("soft-void preserves payments, zeros balance, and blocks further payment", async () => {
    const target = await makeBill(1000);
    expect((await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 200, crypto.randomUUID()))).status).toBe(201);
    const voided = await request(app).delete(`/v1/properties/${propertyId}/bills/${target.id}`)
      .set("Cookie", cookie);
    expect(voided.status).toBe(200);
    const [storedBill] = await db.select().from(bill).where(eq(bill.id, target.id));
    expect(storedBill).toMatchObject({ paidAmount: 200, balance: 0, status: "voided" });
    expect(storedBill!.voidedAt).not.toBeNull();
    expect(await db.select().from(payment).where(eq(payment.billId, target.id))).toHaveLength(1);
    expect((await request(app).get(`/public/invoice/${target.accessToken}`)).status).toBe(404);
    expect((await request(app).get(`/v1/properties/${propertyId}/bills/${target.id}/share-link`)
      .set("Cookie", cookie)).status).toBe(404);
    expect((await request(app).post(`/v1/properties/${propertyId}/bills/${target.id}/deliver`)
      .set("Cookie", cookie).send({ channels: ["email"] })).status).toBe(409);
    expect((await request(app).post(paymentsUrl()).set("Cookie", cookie)
      .send(payload(target.id, 1, crypto.randomUUID()))).status).toBe(409);
  });
});
