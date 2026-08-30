import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, user, ownerProfile, property, room, tenant, bill, payment } from "@pgkhata/db";
import { app } from "../index";

/**
 * Task 2's demo criterion: running bill generation twice for the same month
 * leaves one bill per tenant, enforced by the database rather than by a
 * read-then-insert check the previous implementation relied on.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
const email = `billing-idem-${suffix}@pgkhata.test`;
const password = "billing-idem-password-123";

let userId: string;
let propertyId: string;
let cookie: string[];

describeDb("bill generation idempotency (database)", () => {
  beforeAll(async () => {
    const signUp = await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Billing Idempotency", email, password });
    expect(signUp.status).toBe(200);
    cookie = signUp.headers["set-cookie"] as unknown as string[];

    const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    userId = created!.id;

    const createProperty = await request(app)
      .post("/v1/properties")
      .set("Cookie", cookie)
      .send({ name: `Idempotency PG ${suffix}`, electricityMode: "flat" });
    expect(createProperty.status).toBe(201);
    propertyId = createProperty.body.id;

    const createRoom = await request(app)
      .post(`/v1/properties/${propertyId}/rooms`)
      .set("Cookie", cookie)
      .send({ number: "101", type: "double", capacity: 2, monthlyRent: 7500 });
    expect(createRoom.status).toBe(201);

    const createTenant = await request(app)
      .post(`/v1/properties/${propertyId}/tenants`)
      .set("Cookie", cookie)
      .send({
        name: "Idempotency Tenant",
        phone: `9${String(suffix).slice(-9)}`,
        roomId: createRoom.body.id,
        joiningDate: new Date().toISOString(),
      });
    expect(createTenant.status).toBe(201);
  });

  afterAll(async () => {
    const tenants = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(eq(tenant.propertyId, propertyId));
    for (const t of tenants) {
      const bills = await db.select({ id: bill.id }).from(bill).where(eq(bill.tenantId, t.id));
      for (const b of bills) {
        await db.delete(payment).where(eq(payment.billId, b.id));
      }
      await db.delete(bill).where(eq(bill.tenantId, t.id));
    }
    await db.delete(tenant).where(eq(tenant.propertyId, propertyId));
    await db.delete(room).where(eq(room.propertyId, propertyId));
    await db.delete(property).where(eq(property.id, propertyId));
    await db.delete(ownerProfile).where(eq(ownerProfile.userId, userId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("generates one bill on the first run and none on the second", async () => {
    const first = await request(app)
      .post(`/v1/properties/${propertyId}/bills/generate`)
      .set("Cookie", cookie)
      .send({ month: "2026-05" });

    expect(first.status).toBe(201);
    expect(first.body.generated).toBe(1);
    expect(first.body.skipped).toBe(0);

    const second = await request(app)
      .post(`/v1/properties/${propertyId}/bills/generate`)
      .set("Cookie", cookie)
      .send({ month: "2026-05" });

    // A second run must not error and must not insert.
    expect(second.status).toBe(201);
    expect(second.body.generated).toBe(0);
    expect(second.body.skipped).toBe(1);

    const list = await request(app)
      .get(`/v1/properties/${propertyId}/bills?month=2026-05`)
      .set("Cookie", cookie);

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("rejects a malformed month rather than generating", async () => {
    const res = await request(app)
      .post(`/v1/properties/${propertyId}/bills/generate`)
      .set("Cookie", cookie)
      .send({ month: "May 2026" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
