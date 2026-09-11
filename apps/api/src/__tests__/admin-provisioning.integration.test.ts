import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { db, user, account, ownerProfile, platformAdmin } from "@pgkhata/db";
import { app } from "../index";
import { createPlatformAdmin, teardownAdmins, type TestAdmin } from "./helpers/admin";

/**
 * The console can create a platform admin from just an email. Three properties
 * must hold, and all three are load-bearing:
 *   1. the created account is NOT an owner (raw insert bypasses the owner hook);
 *   2. it has no password until the person sets one on first login;
 *   3. only a pre-created, still-passwordless admin email can be claimed.
 *
 * Runs only when TEST_DATABASE_URL is present.
 */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb("admin provisioning (database)", () => {
  let superAdmin: TestAdmin;
  const email = `provision-${Date.now()}@pgkhata.test`;
  const firstPassword = "first-password-123";
  let createdUserId: string | null = null;

  beforeAll(async () => {
    superAdmin = await createPlatformAdmin(app, {
      label: `prov-super-${Date.now()}`,
      role: "super_admin",
    });
  });

  afterAll(async () => {
    if (createdUserId) {
      await db.delete(platformAdmin).where(eq(platformAdmin.userId, createdUserId));
      await db.delete(account).where(eq(account.userId, createdUserId));
      await db.delete(ownerProfile).where(eq(ownerProfile.userId, createdUserId));
      await db.delete(user).where(eq(user.id, createdUserId));
    }
    await teardownAdmins([superAdmin]);
  });

  it("creates a passwordless, ownerless platform user from just an email", async () => {
    const res = await request(app)
      .post("/v1/admin/admins")
      .set("Cookie", superAdmin.cookie)
      .send({ email, role: "support" });
    expect(res.status).toBe(201);

    const [u] = await db.select().from(user).where(eq(user.email, email));
    expect(u).toBeDefined();
    createdUserId = u!.id;
    expect(u!.emailVerified).toBe(true);

    // The whole point: no owner profile.
    const owner = await db.select().from(ownerProfile).where(eq(ownerProfile.userId, u!.id));
    expect(owner).toHaveLength(0);

    // A credential exists (minted by better-auth) but has no usable password
    // until first login sets one.
    const cred = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, u!.id), eq(account.providerId, "credential")));
    expect(cred).toHaveLength(1);
    expect(cred[0]!.password).toBeNull();
  });

  it("reports the account needs a password, then lets it set one exactly once", async () => {
    const before = await request(app).post("/v1/admin-auth/status").send({ email });
    expect(before.body).toEqual({ needsPassword: true });

    const set = await request(app)
      .post("/v1/admin-auth/set-password")
      .send({ email, password: firstPassword });
    expect(set.status).toBe(200);

    const after = await request(app).post("/v1/admin-auth/status").send({ email });
    expect(after.body).toEqual({ needsPassword: false });

    // The window closes once a password exists.
    const again = await request(app)
      .post("/v1/admin-auth/set-password")
      .send({ email, password: "another-password-123" });
    expect(again.status).toBe(409);
  });

  it("signs in with the new password, is an admin, and is not an owner", async () => {
    const signin = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password: firstPassword });
    expect(signin.status).toBe(200);
    const cookie = signin.headers["set-cookie"] as string[] | undefined;
    expect(cookie).toBeDefined();

    const me = await request(app).get("/v1/admin/me").set("Cookie", cookie!);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe("support");

    // An owner-scoped route rejects them — they have no owner profile.
    const owner = await request(app).get("/v1/properties").set("Cookie", cookie!);
    expect(owner.status).toBe(403);
  });

  it("does not reveal non-admin or unknown emails through status", async () => {
    const unknown = await request(app)
      .post("/v1/admin-auth/status")
      .send({ email: "who@nowhere.test" });
    expect(unknown.body).toEqual({ needsPassword: false });

    // A plain (non-admin) owner is also not claimable here.
    const ownerEmail = superAdmin.email; // super admin has a password already
    const existing = await request(app).post("/v1/admin-auth/status").send({ email: ownerEmail });
    expect(existing.body).toEqual({ needsPassword: false });
  });

  it("refuses to set a password for a non-admin email", async () => {
    const res = await request(app)
      .post("/v1/admin-auth/set-password")
      .send({ email: "who@nowhere.test", password: "irrelevant-123" });
    expect(res.status).toBe(404);
  });
});
