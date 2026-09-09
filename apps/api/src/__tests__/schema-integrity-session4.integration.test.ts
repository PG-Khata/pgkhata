import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  bed,
  billingPolicy,
  complaint,
  db,
  electricityReading,
  expense,
  expenseCategory,
  floor,
  modulePermission,
  notificationPreference,
  occupancyHistory,
  ownerProfile,
  property,
  propertyAmenity,
  rentPlan,
  room,
  securityDeposit,
  staff,
  tenant,
  user,
} from "@pgkhata/db";
import {
  expectPgViolation,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from "./helpers/pg-error";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const suffix = Date.now();

let userId: string;
let ownerId: string;
let propertyA: string;
let propertyB: string;
let floorA: string;
let floorB: string;
let planA: string;
let planB: string;
let roomA: string;
let roomB: string;
let bedA: string;
let bedB: string;
let tenantA: string;
let tenantA2: string;
let tenantB: string;
let categoryA: string;
let categoryB: string;
let staffA: string;
let staffB: string;

describeDb("Session 4 database integrity", () => {
  beforeAll(async () => {
    userId = `session4-${suffix}`;
    await db.insert(user).values({
      id: userId,
      name: "Session 4",
      email: `session4-${suffix}@pgkhata.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const owners = await db.insert(ownerProfile).values({ userId }).returning({ id: ownerProfile.id });
    ownerId = owners[0]!.id;
    const properties = await db.insert(property).values([
      { ownerId, name: `Integrity A ${suffix}` },
      { ownerId, name: `Integrity B ${suffix}` },
    ]).returning({ id: property.id });
    propertyA = properties[0]!.id;
    propertyB = properties[1]!.id;
    const floors = await db.insert(floor).values([
      { propertyId: propertyA, name: "Ground" },
      { propertyId: propertyB, name: "Ground" },
    ]).returning({ id: floor.id });
    floorA = floors[0]!.id;
    floorB = floors[1]!.id;
    const plans = await db.insert(rentPlan).values([
      { propertyId: propertyA, name: "Standard", monthlyRent: 5000 },
      { propertyId: propertyB, name: "Standard", monthlyRent: 5000 },
    ]).returning({ id: rentPlan.id });
    planA = plans[0]!.id;
    planB = plans[1]!.id;
    const rooms = await db.insert(room).values([
      { propertyId: propertyA, floorId: floorA, rentPlanId: planA, number: "101", capacity: 2, monthlyRent: 5000 },
      { propertyId: propertyB, floorId: floorB, rentPlanId: planB, number: "101", capacity: 2, monthlyRent: 5000 },
    ]).returning({ id: room.id });
    roomA = rooms[0]!.id;
    roomB = rooms[1]!.id;
    const beds = await db.insert(bed).values([
      { roomId: roomA, number: "A" },
      { roomId: roomB, number: "A" },
    ]).returning({ id: bed.id });
    bedA = beds[0]!.id;
    bedB = beds[1]!.id;
    const tenants = await db.insert(tenant).values([
      { propertyId: propertyA, roomId: roomA, name: "Tenant A", phone: `71${String(suffix).slice(-8)}`, joiningDate: new Date() },
      { propertyId: propertyA, roomId: roomA, name: "Tenant A2", phone: `72${String(suffix).slice(-8)}`, joiningDate: new Date() },
      { propertyId: propertyB, roomId: roomB, name: "Tenant B", phone: `73${String(suffix).slice(-8)}`, joiningDate: new Date() },
    ]).returning({ id: tenant.id });
    tenantA = tenants[0]!.id;
    tenantA2 = tenants[1]!.id;
    tenantB = tenants[2]!.id;
    const categories = await db.insert(expenseCategory).values([
      { propertyId: propertyA, name: "Maintenance" },
      { propertyId: propertyB, name: "Maintenance" },
    ]).returning({ id: expenseCategory.id });
    categoryA = categories[0]!.id;
    categoryB = categories[1]!.id;
    const staffRows = await db.insert(staff).values([
      { propertyId: propertyA, name: "Manager A", phone: `81${String(suffix).slice(-8)}` },
      { propertyId: propertyB, name: "Manager B", phone: `82${String(suffix).slice(-8)}` },
    ]).returning({ id: staff.id });
    staffA = staffRows[0]!.id;
    staffB = staffRows[1]!.id;
  }, 60000);

  afterAll(async () => {
    await db.delete(modulePermission).where(eq(modulePermission.propertyId, propertyA));
    await db.delete(complaint).where(eq(complaint.propertyId, propertyA));
    await db.delete(securityDeposit).where(eq(securityDeposit.propertyId, propertyA));
    await db.delete(expense).where(eq(expense.propertyId, propertyA));
    await db.delete(electricityReading).where(eq(electricityReading.roomId, roomA));
    await db.delete(occupancyHistory).where(eq(occupancyHistory.propertyId, propertyA));
    await db.delete(notificationPreference).where(eq(notificationPreference.propertyId, propertyA));
    await db.delete(billingPolicy).where(eq(billingPolicy.propertyId, propertyA));
    await db.delete(propertyAmenity).where(eq(propertyAmenity.propertyId, propertyA));
    await db.delete(tenant).where(eq(tenant.propertyId, propertyA));
    await db.delete(tenant).where(eq(tenant.propertyId, propertyB));
    await db.delete(bed).where(eq(bed.roomId, roomA));
    await db.delete(bed).where(eq(bed.roomId, roomB));
    await db.delete(room).where(eq(room.propertyId, propertyA));
    await db.delete(room).where(eq(room.propertyId, propertyB));
    await db.delete(floor).where(eq(floor.propertyId, propertyA));
    await db.delete(floor).where(eq(floor.propertyId, propertyB));
    await db.delete(rentPlan).where(eq(rentPlan.propertyId, propertyA));
    await db.delete(rentPlan).where(eq(rentPlan.propertyId, propertyB));
    await db.delete(expenseCategory).where(eq(expenseCategory.propertyId, propertyA));
    await db.delete(expenseCategory).where(eq(expenseCategory.propertyId, propertyB));
    await db.delete(staff).where(eq(staff.propertyId, propertyA));
    await db.delete(staff).where(eq(staff.propertyId, propertyB));
    await db.delete(property).where(eq(property.ownerId, ownerId));
    await db.delete(ownerProfile).where(eq(ownerProfile.id, ownerId));
    await db.delete(user).where(eq(user.id, userId));
  }, 60000);

  it("rejects room links to another property's floor and rent plan", async () => {
    await expectPgViolation(db.insert(room).values({ propertyId: propertyA, floorId: floorB, number: "201", capacity: 1, monthlyRent: 5000 }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "room_floor_property_fk",
    });
    await expectPgViolation(db.insert(room).values({ propertyId: propertyA, rentPlanId: planB, number: "202", capacity: 1, monthlyRent: 5000 }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "room_rent_plan_property_fk",
    });
  });

  it("rejects tenant room, requested-room, and bed links across properties", async () => {
    await expectPgViolation(db.insert(tenant).values({ propertyId: propertyA, roomId: roomB, name: "Wrong room", phone: `91${String(suffix).slice(-8)}`, joiningDate: new Date() }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "tenant_room_property_fk",
    });
    await expectPgViolation(db.insert(tenant).values({ propertyId: propertyA, requestedRoomId: roomB, name: "Wrong request", phone: `92${String(suffix).slice(-8)}`, joiningDate: new Date() }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "tenant_requested_room_property_fk",
    });
    await expectPgViolation(db.insert(tenant).values({ propertyId: propertyA, roomId: roomA, bedId: bedB, name: "Wrong bed", phone: `93${String(suffix).slice(-8)}`, joiningDate: new Date() }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "tenant_bed_room_fk",
    });
  });

  it("rejects a bed without its room and a non-active bed holder", async () => {
    await expectPgViolation(db.insert(tenant).values({ propertyId: propertyA, bedId: bedA, name: "No room", phone: `94${String(suffix).slice(-8)}`, joiningDate: new Date() }), {
      code: "23514",
      constraint: "tenant_bed_requires_room",
    });
    await expectPgViolation(db.insert(tenant).values({ propertyId: propertyA, roomId: roomA, bedId: bedA, status: "pending", name: "Pending bed", phone: `95${String(suffix).slice(-8)}`, joiningDate: new Date() }), {
      code: "23514",
      constraint: "tenant_bed_requires_active",
    });
  });

  it("rejects cross-property expense, deposit, complaint, and permission children", async () => {
    await expectPgViolation(db.insert(expense).values({ propertyId: propertyA, categoryId: categoryB, amount: 1, description: "Wrong category" }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "expense_category_property_fk",
    });
    await expectPgViolation(db.insert(securityDeposit).values({ propertyId: propertyA, tenantId: tenantB, amount: 1 }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "security_deposit_tenant_property_fk",
    });
    await expectPgViolation(db.insert(complaint).values({ propertyId: propertyA, tenantId: tenantB, subject: "Wrong tenant", description: "Must fail" }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "complaint_tenant_property_fk",
    });
    await expectPgViolation(db.insert(modulePermission).values({ propertyId: propertyA, staffId: staffB, module: "billing" }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "module_permission_staff_property_fk",
    });
  });

  it("allows nullable optional relationships", async () => {
    const [createdRoom] = await db.insert(room).values({ propertyId: propertyA, number: "Nullable", capacity: 1, monthlyRent: 0 }).returning();
    const [createdComplaint] = await db.insert(complaint).values({ propertyId: propertyA, tenantId: null, subject: "Anonymous", description: "No tenant" }).returning();
    expect(createdRoom?.floorId).toBeNull();
    expect(createdRoom?.rentPlanId).toBeNull();
    expect(createdComplaint?.tenantId).toBeNull();
    await db.delete(complaint).where(eq(complaint.id, createdComplaint!.id));
    await db.delete(room).where(eq(room.id, createdRoom!.id));
  });

  it("permits only one open occupancy per bed and enforces its property chain", async () => {
    await db.insert(occupancyHistory).values({ tenantId: tenantA, propertyId: propertyA, roomId: roomA, bedId: bedA, startedOn: new Date() });
    await expectPgViolation(db.insert(occupancyHistory).values({ tenantId: tenantA2, propertyId: propertyA, roomId: roomA, bedId: bedA, startedOn: new Date() }), {
      code: PG_UNIQUE_VIOLATION,
      constraint: "occupancy_history_one_open_per_bed_uq",
    });
    await expectPgViolation(db.insert(occupancyHistory).values({ tenantId: tenantA2, propertyId: propertyB, roomId: roomB, bedId: bedB, startedOn: new Date() }), {
      code: PG_FOREIGN_KEY_VIOLATION,
      constraint: "occupancy_history_tenant_property_fk",
    });
  });

  it("enforces singleton policy/preference/permission natural keys", async () => {
    await db.insert(billingPolicy).values({ propertyId: propertyA });
    await expectPgViolation(db.insert(billingPolicy).values({ propertyId: propertyA }), {
      code: PG_UNIQUE_VIOLATION,
      constraint: "billing_policy_property_uq",
    });
    await db.insert(notificationPreference).values({ propertyId: propertyA, eventType: "rent_due" });
    await expectPgViolation(db.insert(notificationPreference).values({ propertyId: propertyA, eventType: "rent_due" }), {
      code: PG_UNIQUE_VIOLATION,
      constraint: "notification_preference_property_event_uq",
    });
    await db.insert(modulePermission).values({ propertyId: propertyA, staffId: staffA, module: "billing" });
    await expectPgViolation(db.insert(modulePermission).values({ propertyId: propertyA, staffId: staffA, module: "billing" }), {
      code: PG_UNIQUE_VIOLATION,
      constraint: "module_permission_property_staff_module_uq",
    });
  });

  it("normalizes human-facing amenity names, including Unicode", async () => {
    await db.insert(propertyAmenity).values({ propertyId: propertyA, name: "वाई-फाई" });
    await expectPgViolation(db.insert(propertyAmenity).values({ propertyId: propertyA, name: "  वाई-फाई  " }), {
      code: PG_UNIQUE_VIOLATION,
      constraint: "property_amenity_property_name_uq",
    });
    await db.insert(propertyAmenity).values({ propertyId: propertyA, name: "WiFi" });
    await expectPgViolation(db.insert(propertyAmenity).values({ propertyId: propertyA, name: " wifi " }), {
      code: PG_UNIQUE_VIOLATION,
      constraint: "property_amenity_property_name_uq",
    });
  });

  it("serializes concurrent duplicate electricity readings", async () => {
    const attempts = await Promise.allSettled([
      db.insert(electricityReading).values({ roomId: roomA, reading: 100, readingDate: new Date("2026-01-01") }),
      db.insert(electricityReading).values({ roomId: roomA, reading: 100, readingDate: new Date("2026-01-01") }),
    ]);
    expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((x) => x.status === "rejected")).toHaveLength(1);
    const stored = await db.select().from(electricityReading).where(and(
      eq(electricityReading.roomId, roomA),
      eq(electricityReading.readingDate, new Date("2026-01-01")),
    ));
    expect(stored).toHaveLength(1);
  });

  it("updates updated_at even when a direct DB caller omits it", async () => {
    const old = new Date("2000-01-01T00:00:00.000Z");
    const [created] = await db.insert(propertyAmenity).values({ propertyId: propertyA, name: "Timestamp probe", updatedAt: old }).returning();
    const [updated] = await db.update(propertyAmenity).set({ description: "changed" }).where(eq(propertyAmenity.id, created!.id)).returning();
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(new Date("2020-01-01T00:00:00.000Z").getTime());
  });
});
