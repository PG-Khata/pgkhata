import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, user, session, account, ownerProfile } from "@pgkhata/db";
import { app } from "../index";

/**
 * Integration coverage for the defect that blocked every product endpoint: a
 * registered owner had no `owner_profile` row, so `requireOwner` answered 403.
 *
 * Runs only when DATABASE_URL is present. Creates one throwaway account and
 * removes it afterwards, including its session and account rows — deleting the
 * user alone would orphan them.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const probeEmail = `provisioning-probe-${Date.now()}@pgkhata.test`;
const probePassword = "probe-password-12345";
let probeUserId: string | undefined;

describeDb("owner provisioning (database)", () => {
  afterAll(async () => {
    if (!probeUserId) return;
    await db.delete(session).where(eq(session.userId, probeUserId));
    await db.delete(account).where(eq(account.userId, probeUserId));
    await db.delete(ownerProfile).where(eq(ownerProfile.userId, probeUserId));
    await db.delete(user).where(eq(user.id, probeUserId));
  });

  it("registers an owner, provisions one profile, and serves owner routes", async () => {
    const signUp = await request(app).post("/api/auth/sign-up/email").send({
      name: "Provisioning Probe",
      email: probeEmail,
      password: probePassword,
    });

    expect(signUp.status).toBe(200);

    const [created] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, probeEmail));
    expect(created).toBeDefined();
    probeUserId = created!.id;

    // The Better Auth user.create.after hook must have provisioned exactly one.
    const profiles = await db
      .select({ id: ownerProfile.id })
      .from(ownerProfile)
      .where(eq(ownerProfile.userId, probeUserId));
    expect(profiles).toHaveLength(1);

    // The 403 this task exists to remove.
    const cookie = signUp.headers["set-cookie"] as string[] | undefined;
    expect(cookie).toBeDefined();

    const properties = await request(app)
      .get("/v1/properties")
      .set("Cookie", cookie!);

    expect(properties.status).toBe(200);
    expect(Array.isArray(properties.body)).toBe(true);
  });

  it("leaves a single profile when provisioning runs again for the same user", async () => {
    expect(probeUserId).toBeDefined();
    const { ensureOwnerProfile } = await import("@pgkhata/auth");

    const again = await ensureOwnerProfile(db as never, probeUserId!);
    expect(again.created).toBe(false);

    const profiles = await db
      .select({ id: ownerProfile.id })
      .from(ownerProfile)
      .where(eq(ownerProfile.userId, probeUserId!));
    expect(profiles).toHaveLength(1);
  });
});
