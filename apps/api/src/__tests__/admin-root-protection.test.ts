import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, user, account, ownerProfile, platformAdmin } from "@pgkhata/db";
import { app } from "../index";
import { isRootAdminEmail, ROOT_ADMIN_EMAILS } from "../lib/root-admin";
import { registerVerifiedUser } from "./db-auth-helper";
import { createPlatformAdmin, teardownAdmins, type TestAdmin } from "./helpers/admin";

describe("isRootAdminEmail", () => {
  const root = [...ROOT_ADMIN_EMAILS][0]!;
  it("matches a configured root email, case-insensitively", () => {
    expect(isRootAdminEmail(root)).toBe(true);
    expect(isRootAdminEmail(root.toUpperCase())).toBe(true);
  });
  it("does not match anyone else, or null", () => {
    expect(isRootAdminEmail("someone-else@pgkhata.com")).toBe(false);
    expect(isRootAdminEmail(null)).toBe(false);
    expect(isRootAdminEmail(undefined)).toBe(false);
  });
});

/**
 * The chain of command, end to end:
 *   - a root admin (the founder) is untouchable, and only the founder can
 *     change or remove a super admin, or grant super admin;
 *   - a non-founder super admin manages support admins only.
 *
 * Runs only when TEST_DATABASE_URL is present. Everything lives in one file so
 * a single founder fixture (a shared, well-known email) is never created by two
 * files at once.
 */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb("admin chain of command (database)", () => {
  const rootEmail = [...ROOT_ADMIN_EMAILS][0]!;
  const PASSWORD = "integration-password-123";

  let founderUserId: string;
  let founderAdminId: string;
  let founderCookie: string[];
  let superActor: TestAdmin; // a non-founder super_admin
  let superTarget: TestAdmin; // another non-founder super_admin
  let supportTarget: TestAdmin;
  const strayUserIds: string[] = [];

  beforeAll(async () => {
    // Deterministic founder fixture under the configured root email.
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, rootEmail));
    for (const u of existing) {
      await db.delete(platformAdmin).where(eq(platformAdmin.userId, u.id));
      await db.delete(account).where(eq(account.userId, u.id));
      await db.delete(ownerProfile).where(eq(ownerProfile.userId, u.id));
      await db.delete(user).where(eq(user.id, u.id));
    }
    const founder = await registerVerifiedUser(app, {
      name: "Founder",
      email: rootEmail,
      password: PASSWORD,
    });
    founderUserId = founder.userId;
    founderCookie = founder.cookie;
    const [row] = await db
      .insert(platformAdmin)
      .values({ userId: founderUserId, role: "super_admin" })
      .returning({ id: platformAdmin.id });
    founderAdminId = row!.id;

    const stamp = Date.now();
    superActor = await createPlatformAdmin(app, { label: `coc-actor-${stamp}`, role: "super_admin" });
    superTarget = await createPlatformAdmin(app, { label: `coc-super-${stamp}`, role: "super_admin" });
    supportTarget = await createPlatformAdmin(app, { label: `coc-support-${stamp}`, role: "support" });
  });

  afterAll(async () => {
    for (const uid of [founderUserId, ...strayUserIds]) {
      await db.delete(platformAdmin).where(eq(platformAdmin.userId, uid));
      await db.delete(account).where(eq(account.userId, uid));
      await db.delete(ownerProfile).where(eq(ownerProfile.userId, uid));
      await db.delete(user).where(eq(user.id, uid));
    }
    await teardownAdmins([superActor, superTarget, supportTarget]);
  });

  // ── Root protection ───────────────────────────────────────────────

  it("flags the founder in the list and no one else", async () => {
    const res = await request(app).get("/v1/admin/admins").set("Cookie", superActor.cookie);
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ id: string; isRoot: boolean }>;
    expect(rows.find((r) => r.id === founderAdminId)?.isRoot).toBe(true);
    expect(rows.find((r) => r.id === superActor.adminId)?.isRoot).toBe(false);
  });

  it("refuses to change or remove the founder, even by another super admin", async () => {
    const demote = await request(app)
      .patch(`/v1/admin/admins/${founderAdminId}`)
      .set("Cookie", superActor.cookie)
      .send({ role: "support" });
    expect(demote.status).toBe(403);

    const remove = await request(app)
      .delete(`/v1/admin/admins/${founderAdminId}`)
      .set("Cookie", superActor.cookie);
    expect(remove.status).toBe(403);

    const [still] = await db
      .select({ role: platformAdmin.role, isActive: platformAdmin.isActive })
      .from(platformAdmin)
      .where(eq(platformAdmin.id, founderAdminId));
    expect(still).toMatchObject({ role: "super_admin", isActive: true });
  });

  // ── A non-founder super admin ─────────────────────────────────────

  it("cannot change another super admin's role or status", async () => {
    const demote = await request(app)
      .patch(`/v1/admin/admins/${superTarget.adminId}`)
      .set("Cookie", superActor.cookie)
      .send({ role: "support" });
    expect(demote.status).toBe(403);

    const deactivate = await request(app)
      .patch(`/v1/admin/admins/${superTarget.adminId}`)
      .set("Cookie", superActor.cookie)
      .send({ isActive: false });
    expect(deactivate.status).toBe(403);
  });

  it("can manage a support admin's status", async () => {
    const off = await request(app)
      .patch(`/v1/admin/admins/${supportTarget.adminId}`)
      .set("Cookie", superActor.cookie)
      .send({ isActive: false });
    expect(off.status).toBe(200);

    const on = await request(app)
      .patch(`/v1/admin/admins/${supportTarget.adminId}`)
      .set("Cookie", superActor.cookie)
      .send({ isActive: true });
    expect(on.status).toBe(200);
  });

  it("cannot grant super admin, but can add support", async () => {
    const granted = await request(app)
      .post("/v1/admin/admins")
      .set("Cookie", superActor.cookie)
      .send({ email: `coc-new-super-${Date.now()}@pgkhata.test`, role: "super_admin" });
    expect(granted.status).toBe(403);

    const supportEmail = `coc-new-support-${Date.now()}@pgkhata.test`;
    const addedSupport = await request(app)
      .post("/v1/admin/admins")
      .set("Cookie", superActor.cookie)
      .send({ email: supportEmail, role: "support" });
    expect(addedSupport.status).toBe(201);

    const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, supportEmail));
    if (created) strayUserIds.push(created.id);
  });

  // ── The founder ───────────────────────────────────────────────────

  it("lets the founder change a super admin", async () => {
    const res = await request(app)
      .patch(`/v1/admin/admins/${superTarget.adminId}`)
      .set("Cookie", founderCookie)
      .send({ notes: "reviewed by founder" });
    expect(res.status).toBe(200);
  });
});
