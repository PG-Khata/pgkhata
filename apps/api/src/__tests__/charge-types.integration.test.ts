import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, user, ownerProfile, property, chargeType } from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `charge-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Charge ${label}`, email, password: "charge-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Charge PG ${label} ${suffix}` });

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  await db.delete(chargeType).where(eq(chargeType.propertyId, owner.propertyId));
  await db.delete(property).where(eq(property.id, owner.propertyId));
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, owner.userId));
  await db.delete(user).where(eq(user.id, owner.userId));
}

let alice: Owner;
let bob: Owner;

describeDb("charge types (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");
  });

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function types(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/charge-types${path}`;
  }

  it("requires authentication", async () => {
    const res = await request(app).get(types(alice));
    expect(res.status).toBe(401);
  });

  it("seeds exactly one ELEC charge type when a property is created", async () => {
    const list = await request(app).get(types(alice)).set("Cookie", alice.cookie);

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].code).toBe("ELEC");
    expect(list.body[0].name).toBe("Electricity");
    expect(list.body[0].isRecurring).toBe(true);
  });

  it("keeps seeding idempotent across repeated list calls", async () => {
    await request(app).get(types(alice)).set("Cookie", alice.cookie);
    await request(app).get(types(alice)).set("Cookie", alice.cookie);
    const list = await request(app).get(types(alice)).set("Cookie", alice.cookie);

    expect(list.body).toHaveLength(1);
  });

  it("seeds independently per property", async () => {
    const bobList = await request(app).get(types(bob)).set("Cookie", bob.cookie);
    expect(bobList.body).toHaveLength(1);
    expect(bobList.body[0].code).toBe("ELEC");
  });

  it("creates a new charge type and uppercases the code", async () => {
    const res = await request(app)
      .post(types(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Water", code: "water", defaultAmount: 200 });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe("WATER");
  });

  it("rejects a code with lowercase or symbols outside underscore", async () => {
    const res = await request(app)
      .post(types(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Bad", code: "not-a-code!" });

    expect(res.status).toBe(400);
  });

  it("rejects a duplicate code within the property", async () => {
    const res = await request(app)
      .post(types(alice))
      .set("Cookie", alice.cookie)
      .send({ name: "Water Again", code: "WATER" });

    expect(res.status).toBe(409);
  });

  it("allows the same code in a different property", async () => {
    const res = await request(app)
      .post(types(bob))
      .set("Cookie", bob.cookie)
      .send({ name: "Water", code: "WATER" });

    expect(res.status).toBe(201);
  });

  it("hides another owner's charge types", async () => {
    const foreign = await request(app).get(types(alice)).set("Cookie", bob.cookie);
    expect(foreign.status).toBe(404);
  });

  it("updates a non-code field", async () => {
    const list = await request(app).get(types(alice)).set("Cookie", alice.cookie);
    const water = list.body.find((t: { code: string }) => t.code === "WATER");

    const res = await request(app)
      .put(types(alice, `/${water.id}`))
      .set("Cookie", alice.cookie)
      .send({ defaultAmount: 350 });

    expect(res.status).toBe(200);
    expect(res.body.defaultAmount).toBe(350);
  });

  it("refuses to deactivate the electricity charge type", async () => {
    const list = await request(app).get(types(alice)).set("Cookie", alice.cookie);
    const elec = list.body.find((t: { code: string }) => t.code === "ELEC");

    const res = await request(app)
      .put(types(alice, `/${elec.id}`))
      .set("Cookie", alice.cookie)
      .send({ isActive: false });

    expect(res.status).toBe(409);
  });

  it("refuses to delete the electricity charge type", async () => {
    const list = await request(app).get(types(alice)).set("Cookie", alice.cookie);
    const elec = list.body.find((t: { code: string }) => t.code === "ELEC");

    const res = await request(app)
      .delete(types(alice, `/${elec.id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(409);
  });

  it("deletes a non-electricity charge type", async () => {
    const list = await request(app).get(types(alice)).set("Cookie", alice.cookie);
    const water = list.body.find((t: { code: string }) => t.code === "WATER");

    const res = await request(app)
      .delete(types(alice, `/${water.id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);

    const after = await request(app).get(types(alice)).set("Cookie", alice.cookie);
    expect(after.body.some((t: { code: string }) => t.code === "WATER")).toBe(false);
  });

  it("refuses a charge type belonging to another owner", async () => {
    const bobList = await request(app).get(types(bob)).set("Cookie", bob.cookie);

    const res = await request(app)
      .get(types(alice, `/${bobList.body[0].id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(404);
  });
});
