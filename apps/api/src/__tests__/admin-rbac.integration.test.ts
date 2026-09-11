import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request, { type Test } from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, account, blogPost, ownerProfile, platformAdmin, session, user } from "@pgkhata/db";
import { app } from "../index";
import {
  createPlainUser,
  createPlatformAdmin,
  createTestOwner,
  setAdminActive,
  teardownAdmins,
  teardownOwners,
  type TestAdmin,
  type TestOwner,
} from "./helpers/admin";

/**
 * Who may do what on /v1/admin.
 *
 * `admin-route-guards.test.ts` reads the mounted router stack and proves every
 * route carries a guard; it cannot prove the guard decides correctly against a
 * real platform_admin row. That is this file: two roles, a revoked admin, a
 * stranger, and the two changes a super_admin must not be able to make.
 *
 * Runs only when TEST_DATABASE_URL is present.
 */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const suffix = Date.now();
const DENIED = { error: "Platform admin access required" };
const WRONG_ROLE = { error: "Insufficient platform admin role" };

let superA: TestAdmin;
let superB: TestAdmin;
let supportAdmin: TestAdmin;
let deadSuper: TestAdmin;
let deadSupport: TestAdmin;
let stranger: { userId: string; cookie: string[] };
let owner: TestOwner;
let postId: string;
let postSlug: string;

async function readAdmin(adminId: string) {
  const [row] = await db
    .select()
    .from(platformAdmin)
    .where(eq(platformAdmin.id, adminId))
    .limit(1);
  return row;
}

describeDb("platform admin RBAC (database)", () => {
  beforeAll(async () => {
    superA = await createPlatformAdmin(app, {
      label: `rbac-super-a-${suffix}`,
      role: "super_admin",
    });
    superB = await createPlatformAdmin(app, {
      label: `rbac-super-b-${suffix}`,
      role: "super_admin",
    });
    supportAdmin = await createPlatformAdmin(app, {
      label: `rbac-support-${suffix}`,
      role: "support",
    });
    deadSuper = await createPlatformAdmin(app, {
      label: `rbac-dead-super-${suffix}`,
      role: "super_admin",
      isActive: false,
    });
    deadSupport = await createPlatformAdmin(app, {
      label: `rbac-dead-support-${suffix}`,
      role: "support",
      isActive: false,
    });
    stranger = await createPlainUser(app, `rbac-stranger-${suffix}`);
    owner = await createTestOwner(app, { label: `rbac-owner-${suffix}` });

    postSlug = `rbac-post-${suffix}`;
    const created = await request(app)
      .post("/v1/admin/blog/posts")
      .set("Cookie", superA.cookie)
      .send({ title: `RBAC Post ${suffix}`, slug: postSlug, content: "Body copy." });
    expect(created.status).toBe(201);
    postId = created.body.id;
  });

  afterAll(async () => {
    await db.delete(blogPost).where(eq(blogPost.id, postId));
    await teardownAdmins([superA, superB, supportAdmin, deadSuper, deadSupport]);
    await teardownOwners([owner]);
    await db.delete(session).where(eq(session.userId, stranger.userId));
    await db.delete(account).where(eq(account.userId, stranger.userId));
    await db.delete(ownerProfile).where(eq(ownerProfile.userId, stranger.userId));
    await db.delete(user).where(inArray(user.id, [stranger.userId]));
  });

  it("lets a support admin use the whole read surface", async () => {
    const me = await request(app).get("/v1/admin/me").set("Cookie", supportAdmin.cookie);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe("support");

    for (const path of [
      "/v1/admin/owners",
      "/v1/admin/analytics",
      "/v1/admin/properties",
      "/v1/admin/tenants",
      "/v1/admin/bills",
      "/v1/admin/blog/posts",
    ]) {
      const res = await request(app).get(path).set("Cookie", supportAdmin.cookie);
      expect(res.status, `GET ${path} as support`).toBe(200);
    }
  });

  it("refuses a support admin every super_admin-only write", async () => {
    const attempts: [string, () => Test][] = [
      ["PUT /owners/:id", () =>
        request(app).put(`/v1/admin/owners/${owner.ownerId}`).send({ phone: "+919999900001" })],
      ["POST /blog/posts", () =>
        request(app)
          .post("/v1/admin/blog/posts")
          .send({ title: "Sneaky", slug: `sneaky-${suffix}`, content: "x" })],
      ["PUT /blog/posts/:id", () =>
        request(app)
          .put(`/v1/admin/blog/posts/${postId}`)
          .send({ title: "Rewritten", slug: postSlug, content: "x" })],
      ["PATCH /blog/posts/:id/publish", () =>
        request(app).patch(`/v1/admin/blog/posts/${postId}/publish`).send({})],
      ["DELETE /blog/posts/:id", () =>
        request(app).delete(`/v1/admin/blog/posts/${postId}`)],
    ];

    for (const [label, send] of attempts) {
      const res = await send().set("Cookie", supportAdmin.cookie);
      expect(res.status, `${label} as support`).toBe(403);
      expect(res.body).toMatchObject(WRONG_ROLE);
    }

    // Refused, and nothing moved.
    const [post] = await db.select().from(blogPost).where(eq(blogPost.id, postId)).limit(1);
    expect(post).toBeDefined();
    expect(post!.title).toBe(`RBAC Post ${suffix}`);
    expect(post!.published).toBe(false);

    const [profile] = await db
      .select()
      .from(ownerProfile)
      .where(eq(ownerProfile.id, owner.ownerId))
      .limit(1);
    expect(profile!.phone).not.toBe("+919999900001");

    const [sneaky] = await db
      .select()
      .from(blogPost)
      .where(eq(blogPost.slug, `sneaky-${suffix}`))
      .limit(1);
    expect(sneaky).toBeUndefined();
  });

  it("lets a super_admin perform the same writes, so the refusals are about role", async () => {
    const res = await request(app)
      .put(`/v1/admin/owners/${owner.ownerId}`)
      .set("Cookie", superA.cookie)
      .send({ phone: "+919999900002" });
    expect(res.status).toBe(200);

    const [profile] = await db
      .select()
      .from(ownerProfile)
      .where(eq(ownerProfile.id, owner.ownerId))
      .limit(1);
    expect(profile!.phone).toBe("+919999900002");
  });

  it("hides the admin roster from a support admin entirely", async () => {
    // Granting platform access is the one action that can escalate privilege,
    // so `support` gets no read here either.
    const attempts: [string, () => Test][] = [
      ["GET /admins", () => request(app).get("/v1/admin/admins")],
      ["POST /admins", () =>
        request(app).post("/v1/admin/admins").send({ email: superA.email, role: "super_admin" })],
      ["PATCH /admins/:id", () =>
        request(app).patch(`/v1/admin/admins/${supportAdmin.adminId}`).send({ role: "super_admin" })],
      ["DELETE /admins/:id", () =>
        request(app).delete(`/v1/admin/admins/${superB.adminId}`)],
    ];

    for (const [label, send] of attempts) {
      const res = await send().set("Cookie", supportAdmin.cookie);
      expect(res.status, `${label} as support`).toBe(403);
      expect(res.body).toMatchObject(WRONG_ROLE);
    }

    // The self-promotion attempt above must have changed nothing.
    expect((await readAdmin(supportAdmin.adminId))!.role).toBe("support");
    expect(await readAdmin(superB.adminId)).toBeDefined();
  });

  it.each([
    ["a deactivated super_admin", () => deadSuper.cookie],
    ["a deactivated support admin", () => deadSupport.cookie],
  ])("denies %s exactly like a stranger", async (_label, cookie) => {
    // Deactivation is revocation. It must be indistinguishable from never
    // having been an admin — same status, same body, no hint that a row exists.
    const revoked = await request(app).get("/v1/admin/owners").set("Cookie", cookie());
    const outsider = await request(app).get("/v1/admin/owners").set("Cookie", stranger.cookie);

    expect(revoked.status).toBe(403);
    expect(outsider.status).toBe(403);
    expect(revoked.body).toEqual(outsider.body);
    expect(revoked.body).toMatchObject(DENIED);

    // Not "Insufficient platform admin role": that would confirm the row.
    expect(revoked.body).not.toMatchObject(WRONG_ROLE);
  });

  it("reinstates a deactivated admin on the next request when the flag flips back", async () => {
    // Proves the denial above came from is_active and not from a broken fixture.
    expect((await request(app).get("/v1/admin/me").set("Cookie", deadSuper.cookie)).status).toBe(403);

    await setAdminActive(deadSuper.adminId, true);
    const allowed = await request(app).get("/v1/admin/me").set("Cookie", deadSuper.cookie);
    expect(allowed.status).toBe(200);
    expect(allowed.body.role).toBe("super_admin");

    await setAdminActive(deadSuper.adminId, false);
    expect((await request(app).get("/v1/admin/me").set("Cookie", deadSuper.cookie)).status).toBe(403);
  });

  it("refuses to let a super_admin demote or deactivate themselves", async () => {
    // One mis-click here bricks the console, and nobody can undo it from inside.
    const demote = await request(app)
      .patch(`/v1/admin/admins/${superA.adminId}`)
      .set("Cookie", superA.cookie)
      .send({ role: "support" });
    expect(demote.status).toBe(409);

    const deactivate = await request(app)
      .patch(`/v1/admin/admins/${superA.adminId}`)
      .set("Cookie", superA.cookie)
      .send({ isActive: false });
    expect(deactivate.status).toBe(409);

    const remove = await request(app)
      .delete(`/v1/admin/admins/${superA.adminId}`)
      .set("Cookie", superA.cookie);
    expect(remove.status).toBe(409);

    const row = await readAdmin(superA.adminId);
    expect(row!.role).toBe("super_admin");
    expect(row!.isActive).toBe(true);
  });

  it("still allows a super_admin to change another admin, so 409 is not a blanket refusal", async () => {
    const res = await request(app)
      .patch(`/v1/admin/admins/${supportAdmin.adminId}`)
      .set("Cookie", superA.cookie)
      .send({ notes: `Reviewed ${suffix}` });

    expect(res.status).toBe(200);
    expect((await readAdmin(supportAdmin.adminId))!.notes).toBe(`Reviewed ${suffix}`);
  });

  it("cannot be driven down to zero active super admins", async () => {
    // Note on how this invariant is actually reachable: the dedicated
    // "Cannot remove the last active super admin" branch cannot fire over HTTP,
    // because the caller must itself be an active super_admin, so any *other*
    // target implies at least two. The property still holds, and the self-guard
    // is what holds it — which is what this test pins.
    const deactivateOther = await request(app)
      .patch(`/v1/admin/admins/${superB.adminId}`)
      .set("Cookie", superA.cookie)
      .send({ isActive: false });
    expect(deactivateOther.status).toBe(200);
    expect((await readAdmin(superB.adminId))!.isActive).toBe(false);

    // superA is now the only one of this fixture's super admins left. Removing
    // itself — the only remaining way to reach zero — is refused.
    const selfRemoval = await request(app)
      .patch(`/v1/admin/admins/${superA.adminId}`)
      .set("Cookie", superA.cookie)
      .send({ isActive: false });
    expect(selfRemoval.status).toBe(409);
    expect((await readAdmin(superA.adminId))!.isActive).toBe(true);

    // A deactivated super_admin cannot undo its own deactivation either.
    expect(
      (await request(app).get("/v1/admin/admins").set("Cookie", superB.cookie)).status,
    ).toBe(403);

    await setAdminActive(superB.adminId, true);
  });
});
