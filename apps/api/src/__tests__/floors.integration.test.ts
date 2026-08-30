import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, user, ownerProfile, property, room, floor } from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `floors-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Floors ${label}`, email, password: "floors-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Floors PG ${label} ${suffix}` });
  expect(prop.status).toBe(201);

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  await db.delete(room).where(eq(room.propertyId, owner.propertyId));
  await db.delete(floor).where(eq(floor.propertyId, owner.propertyId));
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;
let bob: Owner;

describeDb("floors (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");
  });

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function url(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/floors${path}`;
  }

  it("requires authentication", async () => {
    const res = await request(app).get(url(alice));
    expect(res.status).toBe(401);
  });

  it("creates floors and appends each to the end of the order", async () => {
    for (const name of ["Ground floor", "First floor", "Second floor"]) {
      const res = await request(app)
        .post(url(alice))
        .set("Cookie", alice.cookie)
        .send({ name });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(name);
    }

    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    expect(list.status).toBe(200);
    expect(list.body.map((row: { floor: { name: string } }) => row.floor.name)).toEqual([
      "Ground floor",
      "First floor",
      "Second floor",
    ]);
    expect(list.body.map((row: { floor: { position: number } }) => row.floor.position)).toEqual([
      0, 1, 2,
    ]);
  });

  it("rejects a duplicate floor name within the property", async () => {
    const res = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Ground floor" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("allows the same floor name in a different property", async () => {
    const res = await request(app)
      .post(url(bob))
      .set("Cookie", bob.cookie)
      .send({ name: "Ground floor" });

    expect(res.status).toBe(201);
  });

  it("validates the floor name", async () => {
    const empty = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "" });
    expect(empty.status).toBe(400);

    const long = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "x".repeat(51) });
    expect(long.status).toBe(400);
  });

  it("hides another owner's floors and refuses to read them", async () => {
    const list = await request(app).get(url(bob)).set("Cookie", bob.cookie);
    expect(list.body).toHaveLength(1);

    // Alice's property id with Bob's session: the property is not his.
    const foreign = await request(app).get(url(alice)).set("Cookie", bob.cookie);
    expect(foreign.status).toBe(404);
  });

  it("refuses to read a specific floor through another owner's property", async () => {
    const aliceFloors = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const aliceFloorId = aliceFloors.body[0].floor.id;

    const viaBob = await request(app)
      .get(`/v1/properties/${bob.propertyId}/floors/${aliceFloorId}`)
      .set("Cookie", bob.cookie);

    expect(viaBob.status).toBe(404);
  });

  it("reorders floors and returns the new order", async () => {
    const before = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const ids = before.body.map((row: { floor: { id: string } }) => row.floor.id);

    const res = await request(app)
      .post(url(alice, "/reorder"))
      .set("Cookie", alice.cookie)
      .send({ floorIds: [ids[2], ids[0], ids[1]] });

    expect(res.status).toBe(200);
    expect(res.body.map((f: { id: string }) => f.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(res.body.map((f: { position: number }) => f.position)).toEqual([0, 1, 2]);
  });

  it("rejects a reorder containing a floor from another property", async () => {
    const bobFloors = await request(app).get(url(bob)).set("Cookie", bob.cookie);
    const aliceFloors = await request(app).get(url(alice)).set("Cookie", alice.cookie);

    const res = await request(app)
      .post(url(alice, "/reorder"))
      .set("Cookie", alice.cookie)
      .send({
        floorIds: [aliceFloors.body[0].floor.id, bobFloors.body[0].floor.id],
      });

    expect(res.status).toBe(404);
  });

  it("rejects a reorder with duplicate ids", async () => {
    const floors = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const id = floors.body[0].floor.id;

    const res = await request(app)
      .post(url(alice, "/reorder"))
      .set("Cookie", alice.cookie)
      .send({ floorIds: [id, id] });

    expect(res.status).toBe(400);
  });

  it("renames a floor", async () => {
    const floors = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const id = floors.body[0].floor.id;

    const res = await request(app)
      .put(url(alice, `/${id}`))
      .set("Cookie", alice.cookie)
      .send({ name: "Terrace" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Terrace");
  });

  it("assigns a room to a floor and reports the room count", async () => {
    const floors = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const floorId = floors.body[0].floor.id;

    const created = await request(app)
      .post(`/v1/properties/${alice.propertyId}/rooms`)
      .set("Cookie", alice.cookie)
      .send({ number: "101", capacity: 2, monthlyRent: 6500, floorId });

    expect(created.status).toBe(201);
    expect(created.body.floorId).toBe(floorId);

    const after = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const target = after.body.find(
      (row: { floor: { id: string } }) => row.floor.id === floorId,
    );
    expect(target.roomCount).toBe(1);
  });

  it("refuses a room on another property's floor", async () => {
    const bobFloors = await request(app).get(url(bob)).set("Cookie", bob.cookie);

    const res = await request(app)
      .post(`/v1/properties/${alice.propertyId}/rooms`)
      .set("Cookie", alice.cookie)
      .send({
        number: "999",
        capacity: 1,
        monthlyRent: 5000,
        floorId: bobFloors.body[0].floor.id,
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Floor not found");
  });

  it("refuses to delete a floor that still has rooms", async () => {
    const floors = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const occupied = floors.body.find((row: { roomCount: number }) => row.roomCount > 0);

    const res = await request(app)
      .delete(url(alice, `/${occupied.floor.id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/still has 1 room/i);
  });

  it("deletes an empty floor", async () => {
    const floors = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const empty = floors.body.find((row: { roomCount: number }) => row.roomCount === 0);

    const res = await request(app)
      .delete(url(alice, `/${empty.floor.id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);

    const after = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    expect(
      after.body.some((row: { floor: { id: string } }) => row.floor.id === empty.floor.id),
    ).toBe(false);
  });

  it("leaves a room unassigned when no floor is given", async () => {
    const created = await request(app)
      .post(`/v1/properties/${alice.propertyId}/rooms`)
      .set("Cookie", alice.cookie)
      .send({ number: "201", capacity: 1, monthlyRent: 5000 });

    expect(created.status).toBe(201);
    expect(created.body.floorId).toBeNull();

    const rooms = await request(app)
      .get(`/v1/properties/${alice.propertyId}/rooms`)
      .set("Cookie", alice.cookie);

    const unassigned = rooms.body.find((r: { number: string }) => r.number === "201");
    expect(unassigned.floorName).toBeNull();
  });
});
