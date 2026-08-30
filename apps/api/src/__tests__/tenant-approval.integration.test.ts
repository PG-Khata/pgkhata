import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, user, ownerProfile, property, room, bed, tenant } from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
let phoneSeq = 0;
function nextPhone() {
  phoneSeq += 1;
  const base = 9_700_000_000 + (suffix % 400_000) * 100;
  return String(base + phoneSeq);
}

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `tapproval-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Approval ${label}`, email, password: "approval-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Approval PG ${label} ${suffix}` });

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  const rooms = await db
    .select({ id: room.id })
    .from(room)
    .where(eq(room.propertyId, owner.propertyId));
  const roomIds = rooms.map((r) => r.id);

  const tenants = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.propertyId, owner.propertyId));
  const tenantIds = tenants.map((t) => t.id);

  if (tenantIds.length > 0) {
    await db
      .update(tenant)
      .set({ bedId: null, requestedRoomId: null })
      .where(inArray(tenant.id, tenantIds));
    await db.delete(tenant).where(inArray(tenant.id, tenantIds));
  }
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
let roomId: string;
let signupToken: string;

describeDb("tenant approval workflow (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");

    const roomRes = await request(app)
      .post(`/v1/properties/${alice.propertyId}/rooms`)
      .set("Cookie", alice.cookie)
      .send({ number: "501", capacity: 1, monthlyRent: 6500 });
    roomId = roomRes.body.id;

    signupToken = `approval-signup-${suffix}`;
    await db
      .update(property)
      .set({ signupToken })
      .where(eq(property.id, alice.propertyId));
  }, 20000);

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function tenants(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/tenants${path}`;
  }

  it("creates a self-registered tenant as pending, with no bed assigned", async () => {
    const res = await request(app)
      .post(`/public/signup/${signupToken}`)
      .send({ name: "Pending Tenant", phone: nextPhone(), roomId });

    expect(res.status).toBe(201);
    expect(res.body.tenant.status).toBe("pending");
    expect(res.body.tenant.bedId).toBeNull();
    expect(res.body.tenant.roomId).toBeNull();
  });

  it("does not count a pending tenant as occupying a bed", async () => {
    const bedsRes = await request(app)
      .get(`/v1/properties/${alice.propertyId}/beds`)
      .set("Cookie", alice.cookie);

    expect(bedsRes.status).toBe(200);
    const roomBeds = bedsRes.body.filter((b: { roomId: string }) => b.roomId === roomId);
    expect(roomBeds.every((b: { bed: { status: string } }) => b.bed.status === "vacant")).toBe(
      true,
    );
  });

  it("refuses to approve or reject another owner's tenant", async () => {
    const list = await request(app).get(tenants(alice)).set("Cookie", alice.cookie);
    const pendingId = list.body.find((t: { status: string }) => t.status === "pending").id;

    const approve = await request(app)
      .post(tenants(bob, `/${pendingId}/approve`))
      .set("Cookie", bob.cookie);
    expect(approve.status).toBe(404);

    const reject = await request(app)
      .post(tenants(bob, `/${pendingId}/reject`))
      .set("Cookie", bob.cookie);
    expect(reject.status).toBe(404);
  });

  it("approving places the tenant in the requested room and activates them", async () => {
    const list = await request(app).get(tenants(alice)).set("Cookie", alice.cookie);
    const pendingId = list.body.find((t: { status: string }) => t.status === "pending").id;

    const res = await request(app)
      .post(tenants(alice, `/${pendingId}/approve`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("active");
    expect(res.body.roomId).toBe(roomId);
    expect(res.body.bedId).toBeTruthy();
    expect(res.body.onboardingToken).toBeTruthy();
  });

  it("refuses to re-decide an already approved tenant", async () => {
    const list = await request(app).get(tenants(alice)).set("Cookie", alice.cookie);
    const activeTenant = list.body.find((t: { status: string }) => t.status === "active");

    const res = await request(app)
      .post(tenants(alice, `/${activeTenant.id}/reject`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(409);
  });

  it("exposes the approved tenant's onboarding status publicly", async () => {
    const list = await request(app).get(tenants(alice)).set("Cookie", alice.cookie);
    const activeTenant = list.body.find((t: { status: string }) => t.status === "active");

    const res = await request(app).get(`/public/onboarding/${activeTenant.onboardingToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(activeTenant.name);
    expect(res.body.status).toBe("active");
    expect(res.body.roomNumber).toBe("501");
  });

  it("refuses an onboarding link for an invalid token", async () => {
    const res = await request(app).get("/public/onboarding/not-a-real-token");
    expect(res.status).toBe(404);
  });

  it("rejecting a second pending signup never touches a bed", async () => {
    const second = await request(app)
      .post(`/public/signup/${signupToken}`)
      .send({ name: "Rejected Tenant", phone: nextPhone(), roomId });
    expect(second.status).toBe(201);

    const res = await request(app)
      .post(tenants(alice, `/${second.body.tenant.id}/reject`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.bedId).toBeNull();
  });

  it("refuses to approve a rejected tenant", async () => {
    const list = await request(app).get(tenants(alice)).set("Cookie", alice.cookie);
    const rejectedTenant = list.body.find((t: { status: string }) => t.status === "rejected");

    const res = await request(app)
      .post(tenants(alice, `/${rejectedTenant.id}/approve`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(409);
  });

  it("refuses to generate an onboarding link for a pending tenant", async () => {
    const third = await request(app)
      .post(`/public/signup/${signupToken}`)
      .send({ name: "Another Pending", phone: nextPhone(), roomId });
    expect(third.status).toBe(201);

    const res = await request(app)
      .post(tenants(alice, `/${third.body.tenant.id}/onboarding-link`))
      .set("Cookie", alice.cookie);
    expect(res.status).toBe(409);
  });

  it("refuses to generate an onboarding link for another owner's tenant", async () => {
    const list = await request(app).get(tenants(alice)).set("Cookie", alice.cookie);
    const activeTenant = list.body.find((t: { status: string }) => t.status === "active");

    const res = await request(app)
      .post(tenants(bob, `/${activeTenant.id}/onboarding-link`))
      .set("Cookie", bob.cookie);

    expect(res.status).toBe(404);
  });
});
