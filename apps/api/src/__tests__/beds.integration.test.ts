import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, user, ownerProfile, property, room, bed, tenant } from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `beds-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Beds ${label}`, email, password: "beds-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Beds PG ${label} ${suffix}` });
  expect(prop.status).toBe(201);

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  const rooms = await db
    .select({ id: room.id })
    .from(room)
    .where(eq(room.propertyId, owner.propertyId));
  if (rooms.length > 0) {
    await db.delete(bed).where(inArray(bed.roomId, rooms.map((r) => r.id)));
  }
  await db.delete(tenant).where(eq(tenant.propertyId, owner.propertyId));
  await db.delete(room).where(eq(room.propertyId, owner.propertyId));
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;
let bob: Owner;

describeDb("beds and occupancy (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");
  });

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function rooms(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/rooms${path}`;
  }

  function beds(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/beds${path}`;
  }

  async function createRoom(owner: Owner, number: string, capacity: number) {
    const res = await request(app)
      .post(rooms(owner))
      .set("Cookie", owner.cookie)
      .send({ number, capacity, monthlyRent: 6000 });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  it("auto-creates one bed per unit of capacity, labelled A upward", async () => {
    const roomId = await createRoom(alice, "101", 3);

    const res = await request(app)
      .get(rooms(alice, `/${roomId}/beds`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body.map((b: { number: string }) => b.number)).toEqual(["A", "B", "C"]);
    expect(res.body.every((b: { status: string }) => b.status === "vacant")).toBe(true);
  });

  it("reports every bed as vacant before anyone is assigned", async () => {
    const res = await request(app).get(beds(alice, "/vacant")).set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].roomNumber).toBe("101");
  });

  it("computes occupancy from beds, not rooms", async () => {
    // The defect this task removes: one tenant in a 3-bed room read as 100%.
    const all = await request(app).get(beds(alice)).set("Cookie", alice.cookie);
    const firstBed = all.body[0].bed;

    const marked = await request(app)
      .patch(beds(alice, `/${firstBed.id}/status`))
      .set("Cookie", alice.cookie)
      .send({ status: "occupied" });
    expect(marked.status).toBe(200);

    const dash = await request(app)
      .get(`/v1/dashboard/property/${alice.propertyId}`)
      .set("Cookie", alice.cookie);

    expect(dash.status).toBe(200);
    expect(dash.body.totalRooms).toBe(1);
    expect(dash.body.totalBeds).toBe(3);
    expect(dash.body.occupiedBeds).toBe(1);
    expect(dash.body.occupancyRate).toBe(33);
  });

  it("reflects bed occupancy in the portfolio dashboard too", async () => {
    const dash = await request(app)
      .get("/v1/dashboard/owner")
      .set("Cookie", alice.cookie);

    expect(dash.body.totalBeds).toBe(3);
    expect(dash.body.occupiedBeds).toBe(1);
    expect(dash.body.occupancyRate).toBe(33);
  });

  it("excludes an occupied bed from the vacant list", async () => {
    const res = await request(app).get(beds(alice, "/vacant")).set("Cookie", alice.cookie);
    expect(res.body).toHaveLength(2);
  });

  it("excludes a maintenance bed from the vacant list", async () => {
    const all = await request(app).get(beds(alice)).set("Cookie", alice.cookie);
    const vacantBed = all.body.find((row: { bed: { status: string } }) => row.bed.status === "vacant");

    const res = await request(app)
      .patch(beds(alice, `/${vacantBed.bed.id}/status`))
      .set("Cookie", alice.cookie)
      .send({ status: "maintenance" });
    expect(res.status).toBe(200);

    const vacant = await request(app).get(beds(alice, "/vacant")).set("Cookie", alice.cookie);
    expect(vacant.body).toHaveLength(1);

    // Occupancy counts the maintenance bed in the denominator: it is still a
    // bed the owner paid for and cannot currently sell.
    const dash = await request(app)
      .get(`/v1/dashboard/property/${alice.propertyId}`)
      .set("Cookie", alice.cookie);
    expect(dash.body.totalBeds).toBe(3);
    expect(dash.body.occupancyRate).toBe(33);

    // Put it back for later assertions.
    await request(app)
      .patch(beds(alice, `/${vacantBed.bed.id}/status`))
      .set("Cookie", alice.cookie)
      .send({ status: "vacant" });
  });

  it("refuses to mark an occupied bed as under maintenance", async () => {
    const all = await request(app).get(beds(alice)).set("Cookie", alice.cookie);
    const occupied = all.body.find(
      (row: { bed: { status: string } }) => row.bed.status === "occupied",
    );

    const res = await request(app)
      .patch(beds(alice, `/${occupied.bed.id}/status`))
      .set("Cookie", alice.cookie)
      .send({ status: "maintenance" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/occupied/i);
  });

  it("rejects an unknown bed status", async () => {
    const all = await request(app).get(beds(alice)).set("Cookie", alice.cookie);

    const res = await request(app)
      .patch(beds(alice, `/${all.body[0].bed.id}/status`))
      .set("Cookie", alice.cookie)
      .send({ status: "reserved" });

    expect(res.status).toBe(400);
  });

  it("adds beds on a capacity increase without disturbing existing ones", async () => {
    const roomList = await request(app).get(rooms(alice)).set("Cookie", alice.cookie);
    const target = roomList.body.find((r: { number: string }) => r.number === "101");
    const occupiedBefore = target.beds.find(
      (b: { status: string }) => b.status === "occupied",
    );

    const res = await request(app)
      .put(rooms(alice, `/${target.id}`))
      .set("Cookie", alice.cookie)
      .send({ capacity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.capacity).toBe(5);

    const after = await request(app)
      .get(rooms(alice, `/${target.id}/beds`))
      .set("Cookie", alice.cookie);

    expect(after.body.map((b: { number: string }) => b.number)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);

    // The occupied bed keeps its id and status; nobody is silently moved.
    const stillOccupied = after.body.find(
      (b: { id: string }) => b.id === occupiedBefore.id,
    );
    expect(stillOccupied.status).toBe("occupied");
  });

  it("refuses a capacity decrease that would delete an occupied bed", async () => {
    const roomList = await request(app).get(rooms(alice)).set("Cookie", alice.cookie);
    const target = roomList.body.find((r: { number: string }) => r.number === "101");

    // Occupy bed E, the highest label, so shrinking must be refused.
    const bedE = target.beds.find((b: { number: string }) => b.number === "E");
    await request(app)
      .patch(beds(alice, `/${bedE.id}/status`))
      .set("Cookie", alice.cookie)
      .send({ status: "occupied" });

    const res = await request(app)
      .put(rooms(alice, `/${target.id}`))
      .set("Cookie", alice.cookie)
      .send({ capacity: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/bed E is occupied/i);

    // Nothing changed: not the capacity, not the beds.
    const after = await request(app)
      .get(rooms(alice, `/${target.id}/beds`))
      .set("Cookie", alice.cookie);
    expect(after.body).toHaveLength(5);
  });

  it("allows a capacity decrease once the surplus beds are vacant", async () => {
    const roomList = await request(app).get(rooms(alice)).set("Cookie", alice.cookie);
    const target = roomList.body.find((r: { number: string }) => r.number === "101");
    const bedE = target.beds.find((b: { number: string }) => b.number === "E");

    await request(app)
      .patch(beds(alice, `/${bedE.id}/status`))
      .set("Cookie", alice.cookie)
      .send({ status: "vacant" });

    const res = await request(app)
      .put(rooms(alice, `/${target.id}`))
      .set("Cookie", alice.cookie)
      .send({ capacity: 3 });

    expect(res.status).toBe(200);

    const after = await request(app)
      .get(rooms(alice, `/${target.id}/beds`))
      .set("Cookie", alice.cookie);
    expect(after.body.map((b: { number: string }) => b.number)).toEqual(["A", "B", "C"]);
  });

  it("stores a per-bed rent override and clears it again", async () => {
    const all = await request(app).get(beds(alice)).set("Cookie", alice.cookie);
    const bedId = all.body[0].bed.id;

    const set = await request(app)
      .put(beds(alice, `/${bedId}`))
      .set("Cookie", alice.cookie)
      .send({ monthlyRent: 7200 });
    expect(set.body.monthlyRent).toBe(7200);

    const cleared = await request(app)
      .put(beds(alice, `/${bedId}`))
      .set("Cookie", alice.cookie)
      .send({ monthlyRent: null });
    expect(cleared.body.monthlyRent).toBeNull();
  });

  it("refuses to delete a room while a bed is occupied", async () => {
    const roomList = await request(app).get(rooms(alice)).set("Cookie", alice.cookie);
    const target = roomList.body.find((r: { number: string }) => r.number === "101");

    const res = await request(app)
      .delete(rooms(alice, `/${target.id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/occupied bed/i);
  });

  it("hides beds from another owner", async () => {
    await createRoom(bob, "101", 2);

    const bobBeds = await request(app).get(beds(bob)).set("Cookie", bob.cookie);
    expect(bobBeds.body).toHaveLength(2);

    // Alice's bed id through Bob's property must not resolve.
    const aliceBeds = await request(app).get(beds(alice)).set("Cookie", alice.cookie);
    const foreign = await request(app)
      .get(beds(bob, `/${aliceBeds.body[0].bed.id}`))
      .set("Cookie", bob.cookie);

    expect(foreign.status).toBe(404);
  });

  it("refuses a status change on another owner's bed", async () => {
    const aliceBeds = await request(app).get(beds(alice)).set("Cookie", alice.cookie);

    const res = await request(app)
      .patch(beds(bob, `/${aliceBeds.body[0].bed.id}/status`))
      .set("Cookie", bob.cookie)
      .send({ status: "maintenance" });

    expect(res.status).toBe(404);
  });

  it("deletes beds with the room they belong to", async () => {
    const roomId = await createRoom(alice, "902", 2);

    const del = await request(app)
      .delete(rooms(alice, `/${roomId}`))
      .set("Cookie", alice.cookie);
    expect(del.status).toBe(200);

    const orphans = await db.select().from(bed).where(eq(bed.roomId, roomId));
    expect(orphans).toHaveLength(0);
  });
});
