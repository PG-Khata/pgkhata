import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, user, ownerProfile, property, room, bed, tenant } from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let phoneSeq = 0;
/**
 * Distinct valid Indian mobile numbers. Deriving from the suffix keeps runs
 * isolated; adding rather than concatenating avoids the truncation that made
 * two sequence values produce the same number.
 */
function nextPhone() {
  phoneSeq += 1;
  const base = 9_000_000_000 + (suffix % 900_000) * 100;
  return String(base + phoneSeq);
}

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `assign-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Assign ${label}`, email, password: "assign-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Assign PG ${label} ${suffix}` });

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  const rooms = await db
    .select({ id: room.id })
    .from(room)
    .where(eq(room.propertyId, owner.propertyId));

  await db
    .update(tenant)
    .set({ bedId: null, roomId: null })
    .where(eq(tenant.propertyId, owner.propertyId));
  await db.delete(tenant).where(eq(tenant.propertyId, owner.propertyId));
  if (rooms.length > 0) {
    await db.delete(bed).where(inArray(bed.roomId, rooms.map((r) => r.id)));
  }
  await db.delete(room).where(eq(room.propertyId, owner.propertyId));
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;
let bob: Owner;
let tripleRoomId: string;

describeDb("bed assignment (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");

    const created = await request(app)
      .post(`/v1/properties/${alice.propertyId}/rooms`)
      .set("Cookie", alice.cookie)
      .send({ number: "101", type: "triple", capacity: 3, monthlyRent: 6500 });
    tripleRoomId = created.body.id;
  });

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function tenants(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/tenants${path}`;
  }

  function beds(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/beds${path}`;
  }

  async function addTenant(owner: Owner, name: string, body: object = {}) {
    const res = await request(app)
      .post(tenants(owner))
      .set("Cookie", owner.cookie)
      .send({
        name,
        phone: nextPhone(),
        joiningDate: new Date().toISOString(),
        ...body,
      });
    return res;
  }

  /** Create a pending tenant then approve them, returning the active tenant. */
  async function addAndApproveTenant(owner: Owner, name: string, body: object = {}) {
    const created = await addTenant(owner, name, body);
    if (created.status !== 201) return created;
    const approved = await request(app)
      .post(tenants(owner, `/${created.body.id}/approve`))
      .set("Cookie", owner.cookie);
    return approved;
  }

  async function bedsOfRoom(owner: Owner, roomId: string) {
    const res = await request(app)
      .get(`/v1/properties/${owner.propertyId}/rooms/${roomId}/beds`)
      .set("Cookie", owner.cookie);
    return res.body as Array<{ id: string; number: string; status: string }>;
  }

  it("creates a tenant as pending with no bed when none is requested", async () => {
    const res = await addTenant(alice, "Unassigned Tenant");

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.bedId).toBeNull();
  });

  it("assigns the first vacant bed when a room is named and tenant is approved", async () => {
    const res = await addAndApproveTenant(alice, "Room Picker", { roomId: tripleRoomId });

    expect(res.status).toBe(200);
    expect(res.body.bedId).toBeTruthy();
    expect(res.body.status).toBe("active");
  });

  it("marks the bed occupied after approval", async () => {
    const roomBeds = await bedsOfRoom(alice, tripleRoomId);
    const bedA = roomBeds.find((b) => b.number === "A");

    expect(bedA?.status).toBe("occupied");
  });

  it("takes the next label for the second tenant in the room", async () => {
    const res = await addAndApproveTenant(alice, "Second Occupant", { roomId: tripleRoomId });

    expect(res.status).toBe(200);
    expect(res.body.bedId).toBeTruthy();
  });

  it("assigns a specific bed when one is named", async () => {
    const created = await addTenant(alice, "Bed Picker");
    const roomBeds = await bedsOfRoom(alice, tripleRoomId);
    const bedC = roomBeds.find((b) => b.number === "C")!;

    const res = await request(app)
      .post(tenants(alice, `/${created.body.id}/assign-bed`))
      .set("Cookie", alice.cookie)
      .send({ bedId: bedC.id });

    expect(res.status).toBe(200);
    expect(res.body.bedNumber).toBe("C");
  });

  it("creates a pending tenant even when room is full, but approval fails", async () => {
    const created = await addTenant(alice, "Too Late", { roomId: tripleRoomId });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("pending");

    // Approval fails because the room has no vacant beds.
    const approve = await request(app)
      .post(tenants(alice, `/${created.body.id}/approve`))
      .set("Cookie", alice.cookie);
    expect(approve.status).toBe(409);
    expect(approve.body.error).toMatch(/no vacant beds/i);

    // The tenant remains pending (not deleted).
    const list = await request(app).get(tenants(alice)).set("Cookie", alice.cookie);
    const tooLate = list.body.find((t: { name: string }) => t.name === "Too Late");
    expect(tooLate.status).toBe("pending");
  });

  it("refuses a bed that is already occupied", async () => {
    const created = await addTenant(alice, "Hopeful");
    const roomBeds = await bedsOfRoom(alice, tripleRoomId);
    const bedA = roomBeds.find((b) => b.number === "A")!;

    const res = await request(app)
      .post(tenants(alice, `/${created.body.id}/assign-bed`))
      .set("Cookie", alice.cookie)
      .send({ bedId: bedA.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already occupied/i);
  });

  it("leaves exactly one winner when two requests race for the same bed", async () => {
    const roomId = (
      await request(app)
        .post(`/v1/properties/${alice.propertyId}/rooms`)
        .set("Cookie", alice.cookie)
        .send({ number: "301", capacity: 1, monthlyRent: 9000 })
    ).body.id as string;

    const single = (await bedsOfRoom(alice, roomId))[0]!;

    const first = await addTenant(alice, "Racer One");
    const second = await addTenant(alice, "Racer Two");

    const [a, b] = await Promise.all([
      request(app)
        .post(tenants(alice, `/${first.body.id}/assign-bed`))
        .set("Cookie", alice.cookie)
        .send({ bedId: single.id }),
      request(app)
        .post(tenants(alice, `/${second.body.id}/assign-bed`))
        .set("Cookie", alice.cookie)
        .send({ bedId: single.id }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    // And the database holds one occupant, not two.
    const holders = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(eq(tenant.bedId, single.id));
    expect(holders).toHaveLength(1);
  });

  it("frees the previous bed when a tenant moves", async () => {
    const roomBeds = await bedsOfRoom(alice, tripleRoomId);
    const bedC = roomBeds.find((b) => b.number === "C")!;

    const holders = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(eq(tenant.bedId, bedC.id));
    const mover = holders[0]!;

    // Move them to the single room's bed, which is now free after a vacate.
    const spare = (
      await request(app)
        .post(`/v1/properties/${alice.propertyId}/rooms`)
        .set("Cookie", alice.cookie)
        .send({ number: "302", capacity: 1, monthlyRent: 9500 })
    ).body.id as string;
    const spareBed = (await bedsOfRoom(alice, spare))[0]!;

    const res = await request(app)
      .post(tenants(alice, `/${mover.id}/assign-bed`))
      .set("Cookie", alice.cookie)
      .send({ bedId: spareBed.id });

    expect(res.status).toBe(200);

    const after = await bedsOfRoom(alice, tripleRoomId);
    expect(after.find((b) => b.number === "C")!.status).toBe("vacant");
  });

  it("releases the bed on vacate and is idempotent", async () => {
    const roomBeds = await bedsOfRoom(alice, tripleRoomId);
    const bedB = roomBeds.find((b) => b.number === "B")!;
    const holder = (
      await db.select({ id: tenant.id }).from(tenant).where(eq(tenant.bedId, bedB.id))
    )[0]!;

    const first = await request(app)
      .post(tenants(alice, `/${holder.id}/vacate-bed`))
      .set("Cookie", alice.cookie);
    expect(first.status).toBe(200);
    expect(first.body.freedBedId).toBe(bedB.id);

    const after = await bedsOfRoom(alice, tripleRoomId);
    expect(after.find((b) => b.number === "B")!.status).toBe("vacant");

    // Vacating again must not error or corrupt anything.
    const second = await request(app)
      .post(tenants(alice, `/${holder.id}/vacate-bed`))
      .set("Cookie", alice.cookie);
    expect(second.status).toBe(200);
    expect(second.body.freedBedId).toBeNull();
  });

  it("frees the bed when a tenant is marked vacated", async () => {
    const roomBeds = await bedsOfRoom(alice, tripleRoomId);
    const bedA = roomBeds.find((b) => b.number === "A")!;
    const holder = (
      await db.select({ id: tenant.id }).from(tenant).where(eq(tenant.bedId, bedA.id))
    )[0]!;

    const res = await request(app)
      .put(tenants(alice, `/${holder.id}`))
      .set("Cookie", alice.cookie)
      .send({ status: "vacated" });

    expect(res.status).toBe(200);
    expect(res.body.bedId).toBeNull();

    const after = await bedsOfRoom(alice, tripleRoomId);
    expect(after.find((b) => b.number === "A")!.status).toBe("vacant");
  });

  it("refuses to assign a bed to a vacated tenant", async () => {
    const vacated = (
      await db
        .select({ id: tenant.id })
        .from(tenant)
        .where(eq(tenant.status, "vacated"))
    )[0]!;

    const roomBeds = await bedsOfRoom(alice, tripleRoomId);
    const free = roomBeds.find((b) => b.status === "vacant")!;

    const res = await request(app)
      .post(tenants(alice, `/${vacated.id}/assign-bed`))
      .set("Cookie", alice.cookie)
      .send({ bedId: free.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/vacated/i);
  });

  it("refuses a bed belonging to another owner", async () => {
    await request(app)
      .post(`/v1/properties/${bob.propertyId}/rooms`)
      .set("Cookie", bob.cookie)
      .send({ number: "101", capacity: 1, monthlyRent: 5000 });

    const bobBeds = await request(app).get(beds(bob)).set("Cookie", bob.cookie);
    const aliceTenant = await addTenant(alice, "Cross Owner");

    const res = await request(app)
      .post(tenants(alice, `/${aliceTenant.body.id}/assign-bed`))
      .set("Cookie", alice.cookie)
      .send({ bedId: bobBeds.body[0].bed.id });

    expect(res.status).toBe(404);
  });

  it("reports the bed and room on the tenant list", async () => {
    const list = await request(app).get(tenants(alice)).set("Cookie", alice.cookie);

    const placed = list.body.find((t: { bedNumber: string | null }) => t.bedNumber);
    expect(placed.roomNumber).toBeTruthy();
  });

  it("releases the bed when a tenant is deleted", async () => {
    const approved = await addAndApproveTenant(alice, "Short Stay", { roomId: tripleRoomId });
    expect(approved.status).toBe(200);
    const bedId = approved.body.bedId as string;

    const del = await request(app)
      .delete(tenants(alice, `/${approved.body.id}`))
      .set("Cookie", alice.cookie);
    expect(del.status).toBe(200);

    const [freed] = await db
      .select({ status: bed.status })
      .from(bed)
      .where(eq(bed.id, bedId));
    expect(freed!.status).toBe("vacant");
  });

  it("does not assign a bed at signup — capacity is enforced when approving", async () => {
    const prop = await request(app)
      .get(`/v1/properties/${alice.propertyId}`)
      .set("Cookie", alice.cookie);

    // Give the property a signup token by regenerating through the DB, then use
    // the public route to fill the single remaining bed twice.
    const token = `signup-${suffix}`;
    await db
      .update(property)
      .set({ signupToken: token })
      .where(eq(property.id, alice.propertyId));
    expect(prop.status).toBe(200);

    const roomId = (
      await request(app)
        .post(`/v1/properties/${alice.propertyId}/rooms`)
        .set("Cookie", alice.cookie)
        .send({ number: "401", capacity: 1, monthlyRent: 7000 })
    ).body.id as string;

    // Signup no longer contends for a bed — it only records the request, so
    // both pending signups succeed even though the room holds one bed.
    const first = await request(app)
      .post(`/public/signup/${token}`)
      .send({ name: "Public One", phone: nextPhone(), roomId });
    expect(first.status).toBe(201);
    expect(first.body.tenant.status).toBe("pending");
    expect(first.body.tenant.bedId).toBeNull();

    const second = await request(app)
      .post(`/public/signup/${token}`)
      .send({ name: "Public Two", phone: nextPhone(), roomId });
    expect(second.status).toBe(201);
    expect(second.body.tenant.status).toBe("pending");

    // Capacity is enforced when the owner approves — the first approval
    // takes the room's only bed, the second is refused.
    const approveFirst = await request(app)
      .post(tenants(alice, `/${first.body.tenant.id}/approve`))
      .set("Cookie", alice.cookie);
    expect(approveFirst.status).toBe(200);
    expect(approveFirst.body.status).toBe("active");

    const approveSecond = await request(app)
      .post(tenants(alice, `/${second.body.tenant.id}/approve`))
      .set("Cookie", alice.cookie);
    expect(approveSecond.status).toBe(409);
    expect(approveSecond.body.error).toMatch(/no vacant beds/i);
  });
});
