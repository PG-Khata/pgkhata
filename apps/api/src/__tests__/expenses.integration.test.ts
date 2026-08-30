import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  user,
  ownerProfile,
  property,
  room,
  bed,
  tenant,
  expense,
  expenseCategory,
} from "@pgkhata/db";
import { app } from "../index";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();

interface Owner {
  userId: string;
  cookie: string[];
  propertyId: string;
}

async function createOwner(label: string): Promise<Owner> {
  const email = `expense-${label}-${suffix}@pgkhata.test`;
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: `Expense ${label}`, email, password: "expense-password-123" });
  expect(signUp.status).toBe(200);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const cookie = signUp.headers["set-cookie"] as unknown as string[];

  const prop = await request(app)
    .post("/v1/properties")
    .set("Cookie", cookie)
    .send({ name: `Expense PG ${label} ${suffix}` });

  return { userId: created!.id, cookie, propertyId: prop.body.id };
}

async function teardown(owner: Owner) {
  await db.delete(expense).where(eq(expense.propertyId, owner.propertyId));
  await db.delete(expenseCategory).where(eq(expenseCategory.propertyId, owner.propertyId));

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
    await db.update(tenant).set({ bedId: null }).where(inArray(tenant.id, tenantIds));
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
let categoryId: string;

describeDb("expenses (database)", () => {
  beforeAll(async () => {
    alice = await createOwner("alice");
    bob = await createOwner("bob");

    const category = await request(app)
      .post(`/v1/properties/${alice.propertyId}/expenses/categories`)
      .set("Cookie", alice.cookie)
      .send({ name: "Maintenance" });
    categoryId = category.body.id;
  }, 20000);

  afterAll(async () => {
    await teardown(alice);
    await teardown(bob);
  });

  function url(owner: Owner, path = "") {
    return `/v1/properties/${owner.propertyId}/expenses${path}`;
  }

  it("requires authentication", async () => {
    const res = await request(app).get(url(alice));
    expect(res.status).toBe(401);
  });

  it("creates a category", async () => {
    expect(categoryId).toBeTruthy();
  });

  it("refuses a duplicate category name for the same property", async () => {
    const res = await request(app)
      .post(url(alice, "/categories"))
      .set("Cookie", alice.cookie)
      .send({ name: "Maintenance" });

    expect(res.status).toBe(409);
  });

  it("allows the same category name for a different owner's property", async () => {
    const res = await request(app)
      .post(url(bob, "/categories"))
      .set("Cookie", bob.cookie)
      .send({ name: "Maintenance" });

    expect(res.status).toBe(201);
  });

  it("records an expense as pending", async () => {
    const res = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ categoryId, amount: 1500, description: "Plumbing repair" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
  });

  it("refuses an expense against another owner's category", async () => {
    const res = await request(app)
      .post(url(bob))
      .set("Cookie", bob.cookie)
      .send({ categoryId, amount: 500, description: "Cross-owner" });

    expect(res.status).toBe(404);
  });

  it("rejects a non-positive amount", async () => {
    const res = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ categoryId, amount: 0, description: "Invalid" });

    expect(res.status).toBe(400);
  });

  it("lists expenses scoped to the property with category name attached", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
    expect(list.body[0].categoryName).toBe("Maintenance");

    const bobList = await request(app).get(url(bob)).set("Cookie", bob.cookie);
    expect(bobList.body).toHaveLength(0);
  });

  it("approves a pending expense and records who approved it", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const expenseId = list.body[0].expense.id;

    const res = await request(app)
      .post(url(alice, `/${expenseId}/approve`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.approvedBy).toBe(alice.userId);
    expect(res.body.approvedAt).toBeTruthy();
  });

  it("refuses to re-decide an already approved expense", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const expenseId = list.body[0].expense.id;

    const res = await request(app)
      .post(url(alice, `/${expenseId}/reject`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(409);
  });

  it("refuses to decide another owner's expense", async () => {
    const list = await request(app).get(url(alice)).set("Cookie", alice.cookie);
    const expenseId = list.body[0].expense.id;

    const res = await request(app)
      .post(url(bob, `/${expenseId}/approve`))
      .set("Cookie", bob.cookie);

    expect(res.status).toBe(404);
  });

  it("rejects a second pending expense", async () => {
    const created = await request(app)
      .post(url(alice))
      .set("Cookie", alice.cookie)
      .send({ categoryId, amount: 750, description: "Disputed charge" });

    const res = await request(app)
      .post(url(alice, `/${created.body.id}/reject`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
  });

  it("summarizes approved spend, excluding pending and rejected", async () => {
    const summary = await request(app).get(url(alice, "/summary")).set("Cookie", alice.cookie);

    expect(summary.status).toBe(200);
    // Only the first (approved) expense of 1500 counts toward total.
    expect(summary.body.total).toBe(1500);
    expect(summary.body.pendingTotal).toBe(0);
    expect(summary.body.byCategory).toEqual([
      { categoryId, categoryName: "Maintenance", total: 1500, count: 1 },
    ]);
  });

  it("scopes the summary to the requesting owner only", async () => {
    const bobSummary = await request(app).get(url(bob, "/summary")).set("Cookie", bob.cookie);

    expect(bobSummary.status).toBe(200);
    expect(bobSummary.body).toEqual({
      total: 0,
      pendingTotal: 0,
      byCategory: [],
      byMonth: [],
    });
  });

  it("refuses to delete a category that has expenses recorded against it", async () => {
    const res = await request(app)
      .delete(url(alice, `/categories/${categoryId}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(409);
  });

  it("refuses to delete another owner's category", async () => {
    const categories = await request(app)
      .get(url(bob, "/categories"))
      .set("Cookie", bob.cookie);
    const bobCategoryId = categories.body[0].id;

    const res = await request(app)
      .delete(url(alice, `/categories/${bobCategoryId}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(404);
  });

  it("deletes an unused category", async () => {
    const created = await request(app)
      .post(url(alice, "/categories"))
      .set("Cookie", alice.cookie)
      .send({ name: "Unused Category" });

    const res = await request(app)
      .delete(url(alice, `/categories/${created.body.id}`))
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(204);
  });
});
