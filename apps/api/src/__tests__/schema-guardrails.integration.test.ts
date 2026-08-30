import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  user,
  ownerProfile,
  property,
  room,
  tenant,
  bill,
  payment,
} from "@pgkhata/db";
import {
  expectPgViolation,
  PG_UNIQUE_VIOLATION,
  PG_RESTRICT_VIOLATION,
} from "./helpers/pg-error";

/**
 * These invariants live in the database, not the application, so they can only
 * be proven against a real one. Each was documented in
 * data-points/Database.md as a defect the rebuild had reopened.
 *
 * Runs only when DATABASE_URL is present.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let userId: string;
let ownerId: string;
let propertyId: string;
let roomId: string;
let tenantId: string;

describeDb("schema guardrails (database)", () => {
  beforeAll(async () => {
    userId = `guardrail-user-${suffix}`;
    await db.insert(user).values({
      id: userId,
      name: "Guardrail Fixture",
      email: `guardrail-${suffix}@pgkhata.test`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [owner] = await db.insert(ownerProfile).values({ userId }).returning();
    ownerId = owner!.id;

    const [prop] = await db
      .insert(property)
      .values({ ownerId, name: `Guardrail PG ${suffix}` })
      .returning();
    propertyId = prop!.id;

    const [r] = await db
      .insert(room)
      .values({ propertyId, number: "101", capacity: 2, monthlyRent: 6500 })
      .returning();
    roomId = r!.id;

    const [t] = await db
      .insert(tenant)
      .values({
        propertyId,
        roomId,
        name: "Guardrail Tenant",
        phone: `9${String(suffix).slice(-9)}`,
        joiningDate: new Date(),
      })
      .returning();
    tenantId = t!.id;
  });

  afterAll(async () => {
    // Teardown must respect the very restrict rules under test: leaves first.
    const bills = await db
      .select({ id: bill.id })
      .from(bill)
      .where(eq(bill.tenantId, tenantId));
    for (const b of bills) {
      await db.delete(payment).where(eq(payment.billId, b.id));
    }
    await db.delete(bill).where(eq(bill.tenantId, tenantId));
    await db.delete(tenant).where(eq(tenant.propertyId, propertyId));
    await db.delete(room).where(eq(room.propertyId, propertyId));
    await db.delete(property).where(eq(property.id, propertyId));
    await db.delete(ownerProfile).where(eq(ownerProfile.id, ownerId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("refuses a second bill for the same tenant and month", async () => {
    const [first] = await db
      .insert(bill)
      .values({
        tenantId,
        billMonth: "2026-01",
        rentAmount: 6500,
        totalAmount: 6500,
        balance: 6500,
      })
      .returning();
    expect(first).toBeDefined();

    // Billing idempotency: the app-level "does a bill exist?" check cannot stop
    // two concurrent generation runs. The constraint can.
    await expectPgViolation(
      db.insert(bill).values({
        tenantId,
        billMonth: "2026-01",
        rentAmount: 6500,
        totalAmount: 6500,
        balance: 6500,
      }),
      { code: PG_UNIQUE_VIOLATION, constraint: "bill_tenant_month_uq" },
    );
  });

  it("allows the same tenant to be billed for a different month", async () => {
    const [second] = await db
      .insert(bill)
      .values({
        tenantId,
        billMonth: "2026-02",
        rentAmount: 6500,
        totalAmount: 6500,
        balance: 6500,
      })
      .returning();

    expect(second?.billMonth).toBe("2026-02");
  });

  it("refuses a duplicate room number within one property", async () => {
    await expectPgViolation(
      db.insert(room).values({
        propertyId,
        number: "101",
        capacity: 1,
        monthlyRent: 5000,
      }),
      { code: PG_UNIQUE_VIOLATION, constraint: "room_property_number_uq" },
    );
  });

  it("allows the same room number in a different property", async () => {
    const [other] = await db
      .insert(property)
      .values({ ownerId, name: `Guardrail PG B ${suffix}` })
      .returning();

    const [r] = await db
      .insert(room)
      .values({
        propertyId: other!.id,
        number: "101",
        capacity: 1,
        monthlyRent: 5000,
      })
      .returning();

    expect(r?.number).toBe("101");

    await db.delete(room).where(eq(room.propertyId, other!.id));
    await db.delete(property).where(eq(property.id, other!.id));
  });

  it("refuses to delete a property while tenants exist", async () => {
    // Previously cascade: one DELETE removed rooms, tenants, bills, payments.
    await expectPgViolation(
      db.delete(property).where(eq(property.id, propertyId)),
      {
        code: PG_RESTRICT_VIOLATION,
        constraint: "tenant_property_id_property_id_fk",
      },
    );

    // And the tenant is still there.
    const survivors = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(eq(tenant.propertyId, propertyId));
    expect(survivors).toHaveLength(1);
  });

  it("refuses to delete a tenant while bills exist", async () => {
    await expectPgViolation(db.delete(tenant).where(eq(tenant.id, tenantId)), {
      code: PG_RESTRICT_VIOLATION,
      constraint: "bill_tenant_id_tenant_id_fk",
    });
  });

  it("refuses to delete a bill while payments exist", async () => {
    const [b] = await db
      .insert(bill)
      .values({
        tenantId,
        billMonth: "2026-03",
        rentAmount: 6500,
        totalAmount: 6500,
        balance: 6500,
      })
      .returning();

    await db.insert(payment).values({
      billId: b!.id,
      amount: 2000,
      paymentDate: new Date(),
      method: "upi",
    });

    await expectPgViolation(db.delete(bill).where(eq(bill.id, b!.id)), {
      code: PG_RESTRICT_VIOLATION,
      constraint: "payment_bill_id_bill_id_fk",
    });
  });
});
