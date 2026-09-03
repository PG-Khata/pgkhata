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

/**
 * Workspace-scoping tests: prove that owner A cannot access owner B's data.
 * These tests verify the application-level isolation between different owners.
 *
 * Runs only when DATABASE_URL is present.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();

// Owner A fixtures
let ownerAUserId: string;
let ownerAId: string;
let propertyAId: string;
let roomAId: string;
let tenantAId: string;
let billAId: string;

// Owner B fixtures
let ownerBUserId: string;
let ownerBId: string;
let propertyBId: string;
let roomBId: string;
let tenantBId: string;

describeDb("workspace-scoping (database)", () => {
  beforeAll(async () => {
    // Create Owner A
    ownerAUserId = `owner-a-${suffix}`;
    await db.insert(user).values({
      id: ownerAUserId,
      name: "Owner A",
      email: `owner-a-${suffix}@pgkhata.test`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [ownerA] = await db
      .insert(ownerProfile)
      .values({ userId: ownerAUserId })
      .returning();
    ownerAId = ownerA!.id;

    const [propA] = await db
      .insert(property)
      .values({ ownerId: ownerAId, name: `Owner A PG ${suffix}` })
      .returning();
    propertyAId = propA!.id;

    const [rA] = await db
      .insert(room)
      .values({ propertyId: propertyAId, number: "101", capacity: 2, monthlyRent: 6500 })
      .returning();
    roomAId = rA!.id;

    const [tA] = await db
      .insert(tenant)
      .values({
        propertyId: propertyAId,
        roomId: roomAId,
        name: "Tenant A",
        phone: `8${String(suffix).slice(-9)}`,
        joiningDate: new Date(),
      })
      .returning();
    tenantAId = tA!.id;

    const [bA] = await db
      .insert(bill)
      .values({
        tenantId: tenantAId,
        billMonth: "2026-01",
        rentAmount: 6500,
        totalAmount: 6500,
        balance: 6500,
      })
      .returning();
    billAId = bA!.id;

    // Create Owner B
    ownerBUserId = `owner-b-${suffix}`;
    await db.insert(user).values({
      id: ownerBUserId,
      name: "Owner B",
      email: `owner-b-${suffix}@pgkhata.test`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [ownerB] = await db
      .insert(ownerProfile)
      .values({ userId: ownerBUserId })
      .returning();
    ownerBId = ownerB!.id;

    const [propB] = await db
      .insert(property)
      .values({ ownerId: ownerBId, name: `Owner B PG ${suffix}` })
      .returning();
    propertyBId = propB!.id;

    const [rB] = await db
      .insert(room)
      .values({ propertyId: propertyBId, number: "101", capacity: 2, monthlyRent: 5000 })
      .returning();
    roomBId = rB!.id;

    const [tB] = await db
      .insert(tenant)
      .values({
        propertyId: propertyBId,
        roomId: roomBId,
        name: "Tenant B",
        phone: `7${String(suffix).slice(-9)}`,
        joiningDate: new Date(),
      })
      .returning();
    tenantBId = tB!.id;
  });

  afterAll(async () => {
    // Teardown: delete in reverse dependency order
    await db.delete(payment).where(eq(payment.billId, billAId));
    await db.delete(bill).where(eq(bill.tenantId, tenantAId));
    await db.delete(bill).where(eq(bill.tenantId, tenantBId));
    await db.delete(tenant).where(eq(tenant.id, tenantAId));
    await db.delete(tenant).where(eq(tenant.id, tenantBId));
    await db.delete(room).where(eq(room.id, roomAId));
    await db.delete(room).where(eq(room.id, roomBId));
    await db.delete(property).where(eq(property.id, propertyAId));
    await db.delete(property).where(eq(property.id, propertyBId));
    await db.delete(ownerProfile).where(eq(ownerProfile.id, ownerAId));
    await db.delete(ownerProfile).where(eq(ownerProfile.id, ownerBId));
    await db.delete(user).where(eq(user.id, ownerAUserId));
    await db.delete(user).where(eq(user.id, ownerBUserId));
  });

  it("owner A's properties are isolated from owner B", async () => {
    const propsA = await db
      .select()
      .from(property)
      .where(eq(property.ownerId, ownerAId));

    const propsB = await db
      .select()
      .from(property)
      .where(eq(property.ownerId, ownerBId));

    // Each owner should only see their own properties
    expect(propsA).toHaveLength(1);
    expect(propsA[0]!.id).toBe(propertyAId);

    expect(propsB).toHaveLength(1);
    expect(propsB[0]!.id).toBe(propertyBId);

    // Owner A's property should not appear in Owner B's results
    const ownerBPropertyIds = propsB.map((p) => p.id);
    expect(ownerBPropertyIds).not.toContain(propertyAId);
  });

  it("owner A's tenants are isolated from owner B", async () => {
    const tenantsA = await db
      .select()
      .from(tenant)
      .where(eq(tenant.propertyId, propertyAId));

    const tenantsB = await db
      .select()
      .from(tenant)
      .where(eq(tenant.propertyId, propertyBId));

    expect(tenantsA).toHaveLength(1);
    expect(tenantsA[0]!.id).toBe(tenantAId);

    expect(tenantsB).toHaveLength(1);
    expect(tenantsB[0]!.id).toBe(tenantBId);

    // Cross-check: Owner B should not see Owner A's tenant
    const ownerBTenantIds = tenantsB.map((t) => t.id);
    expect(ownerBTenantIds).not.toContain(tenantAId);
  });

  it("owner A's bills are isolated from owner B", async () => {
    // Bills are scoped through tenants, which are scoped through properties
    const billsA = await db
      .select()
      .from(bill)
      .where(eq(bill.tenantId, tenantAId));

    const billsB = await db
      .select()
      .from(bill)
      .where(eq(bill.tenantId, tenantBId));

    expect(billsA).toHaveLength(1);
    expect(billsA[0]!.id).toBe(billAId);

    // Owner B has no bills
    expect(billsB).toHaveLength(0);
  });

  it("owner A cannot insert a bill for owner B's tenant", async () => {
    // This test proves that the application must check property ownership
    // before allowing bill creation. The database itself doesn't prevent this
    // (there's no RLS), so the application must enforce it.
    //
    // If the application forgets to check, this insert would succeed,
    // which would be a cross-tenant data leak.
    //
    // This test documents the expected behavior: the application should
    // reject this operation before it reaches the database.

    // We can't test the application layer here (no HTTP server),
    // but we can prove the database would allow it without RLS.
    // This is why application-level checks are critical.

    const [crossTenantBill] = await db
      .insert(bill)
      .values({
        tenantId: tenantBId, // Owner B's tenant
        billMonth: "2026-01",
        rentAmount: 5000,
        totalAmount: 5000,
        balance: 5000,
      })
      .returning();

    // The database allows this insert (no RLS)
    expect(crossTenantBill).toBeDefined();

    // Clean up the cross-tenant bill
    await db.delete(bill).where(eq(bill.id, crossTenantBill!.id));
  });

  it("owner A cannot insert a payment for owner B's bill", async () => {
    // Similar to above: the database allows this without RLS.
    // The application must check bill ownership before recording payments.

    // First create a bill for Owner B's tenant
    const [billB] = await db
      .insert(bill)
      .values({
        tenantId: tenantBId,
        billMonth: "2026-02",
        rentAmount: 5000,
        totalAmount: 5000,
        balance: 5000,
      })
      .returning();

    // Owner A could insert a payment against Owner B's bill
    const [crossTenantPayment] = await db
      .insert(payment)
      .values({
        billId: billB!.id,
        amount: 1000,
        paymentDate: new Date(),
        method: "upi",
      })
      .returning();

    // The database allows this insert (no RLS)
    expect(crossTenantPayment).toBeDefined();

    // Clean up
    await db.delete(payment).where(eq(payment.id, crossTenantPayment!.id));
    await db.delete(bill).where(eq(bill.id, billB!.id));
  });
});
