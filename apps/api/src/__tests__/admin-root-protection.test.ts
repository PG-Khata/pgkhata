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
 * A root admin cannot be changed or removed by anyone — not even another active
 * super_admin. Runs only when TEST_DATABASE_URL is present.
 */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb("root admin protection (database)", () => {
  const rootEmail = [...ROOT_ADMIN_EMAILS][0]!;
  let actor: TestAdmin;
  let rootUserId: string;
  let rootAdminId: string;

  beforeAll(async () => {
    actor = await createPlatformAdmin(app, {
      label: `root-actor-${Date.now()}`,
      role: "super_admin",
    });

    // The root user must exist under the configured email. Clear any prior row
    // so the fixture is deterministic in a shared test database.
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, rootEmail));
    for (const u of existing) {
      await db.delete(platformAdmin).where(eq(platformAdmin.userId, u.id));
      await db.delete(account).where(eq(account.userId, u.id));
      await db.delete(ownerProfile).where(eq(ownerProfile.userId, u.id));
      await db.delete(user).where(eq(user.id, u.id));
    }

    const { userId } = await registerVerifiedUser(app, {
      name: "Root Admin",
      email: rootEmail,
      password: "integration-password-123",
    });
    rootUserId = userId;
    const [row] = await db
      .insert(platformAdmin)
      .values({ userId, role: "super_admin" })
      .returning({ id: platformAdmin.id });
    rootAdminId = row!.id;
  });

  afterAll(async () => {
    await db.delete(platformAdmin).where(eq(platformAdmin.userId, rootUserId));
    await db.delete(account).where(eq(account.userId, rootUserId));
    await db.delete(ownerProfile).where(eq(ownerProfile.userId, rootUserId));
    await db.delete(user).where(eq(user.id, rootUserId));
    await teardownAdmins([actor]);
  });

  it("flags the root admin in the list and no one else", async () => {
    const res = await request(app).get("/v1/admin/admins").set("Cookie", actor.cookie);
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ id: string; isRoot: boolean }>;
    expect(rows.find((r) => r.id === rootAdminId)?.isRoot).toBe(true);
    expect(rows.find((r) => r.id === actor.adminId)?.isRoot).toBe(false);
  });

  it("refuses to demote the root admin (403)", async () => {
    const res = await request(app)
      .patch(`/v1/admin/admins/${rootAdminId}`)
      .set("Cookie", actor.cookie)
      .send({ role: "support" });
    expect(res.status).toBe(403);
  });

  it("refuses to deactivate the root admin (403)", async () => {
    const res = await request(app)
      .patch(`/v1/admin/admins/${rootAdminId}`)
      .set("Cookie", actor.cookie)
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it("refuses to remove the root admin (403)", async () => {
    const res = await request(app)
      .delete(`/v1/admin/admins/${rootAdminId}`)
      .set("Cookie", actor.cookie);
    expect(res.status).toBe(403);

    // Still there and still super_admin.
    const [still] = await db
      .select({ role: platformAdmin.role, isActive: platformAdmin.isActive })
      .from(platformAdmin)
      .where(eq(platformAdmin.id, rootAdminId));
    expect(still).toMatchObject({ role: "super_admin", isActive: true });
  });
});
