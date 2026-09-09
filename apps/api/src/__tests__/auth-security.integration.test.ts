import "dotenv/config";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { account, db, ownerProfile, session, user } from "@pgkhata/db";
import { sendEmail } from "@pgkhata/email";
import { app } from "../index";
import { registerVerifiedUser } from "./db-auth-helper";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const createdUserIds: string[] = [];

afterEach(() => vi.mocked(sendEmail).mockResolvedValue({ id: "test-email" } as never));

describeDb("authentication security (database)", () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.delete(session).where(eq(session.userId, userId));
      await db.delete(account).where(eq(account.userId, userId));
      await db.delete(ownerProfile).where(eq(ownerProfile.userId, userId));
      await db.delete(user).where(eq(user.id, userId));
    }
  });

  it("requires the emailed six-digit OTP before sign-in", async () => {
    const email = `otp-${Date.now()}@pgkhata.test`;
    const password = "otp-password-123";
    const signUp = await request(app).post("/api/auth/sign-up/email")
      .set("x-forwarded-for", "2001:db8:100::1")
      .send({ name: "OTP Owner", email, password });
    expect(signUp.status).toBe(200);
    expect(signUp.headers["set-cookie"]).toBeUndefined();

    const [created] = await db.select({ id: user.id, verified: user.emailVerified })
      .from(user).where(eq(user.email, email));
    createdUserIds.push(created!.id);
    expect(created!.verified).toBe(false);

    const beforeVerification = await request(app).post("/api/auth/sign-in/email")
      .set("x-forwarded-for", "2001:db8:101::1").send({ email, password });
    expect(beforeVerification.status).toBe(403);

    const emailCall = vi.mocked(sendEmail).mock.calls.find(([message]) => message.to === email);
    const otp = emailCall?.[0].html.match(/\b\d{6}\b/)?.[0];
    expect(otp).toMatch(/^\d{6}$/);

    const verified = await request(app).post("/api/auth/email-otp/verify-email")
      .set("x-forwarded-for", "2001:db8:102::1").send({ email, otp });
    expect(verified.status).toBe(200);
    const [updated] = await db.select({ verified: user.emailVerified }).from(user).where(eq(user.id, created!.id));
    expect(updated!.verified).toBe(true);
  });

  it("leaves the account unverified when email delivery is down", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("provider unavailable"));
    const email = `otp-down-${Date.now()}@pgkhata.test`;
    const signUp = await request(app).post("/api/auth/sign-up/email")
      .set("x-forwarded-for", "2001:db8:103::1")
      .send({ name: "Email Down", email, password: "email-down-password-123" });
    expect(signUp.status).toBe(200);
    const [created] = await db.select({ id: user.id, verified: user.emailVerified })
      .from(user).where(eq(user.email, email));
    createdUserIds.push(created!.id);
    expect(created!.verified).toBe(false);
  });

  it("rate-limits the sixth rapid password attack from one client", async () => {
    const email = `rate-${Date.now()}@pgkhata.test`;
    const registered = await registerVerifiedUser(app, {
      name: "Rate Owner", email, password: "correct-password-123",
    });
    createdUserIds.push(registered.userId);
    const statuses: number[] = [];
    const attackIp = `2001:db8:104:${(Date.now() % 65_535).toString(16)}::1`;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await request(app).post("/api/auth/sign-in/email")
        .set("x-forwarded-for", attackIp)
        .send({ email, password: "wrong-password" })).status);
    }
    expect(statuses.slice(0, 5)).not.toContain(429);
    expect(statuses[5]).toBe(429);
  });

  it("revokes every existing session after a password reset", async () => {
    const email = `reset-${Date.now()}@pgkhata.test`;
    const password = "old-reset-password-123";
    const registered = await registerVerifiedUser(app, { name: "Reset Owner", email, password });
    createdUserIds.push(registered.userId);
    const secondSignIn = await request(app).post("/api/auth/sign-in/email")
      .set("x-forwarded-for", "2001:db8:105::1").send({ email, password });
    const secondCookie = secondSignIn.headers["set-cookie"] as unknown as string[];

    vi.mocked(sendEmail).mockClear();
    const requested = await request(app).post("/api/auth/request-password-reset")
      .set("x-forwarded-for", "2001:db8:106::1").send({ email });
    expect(requested.status).toBe(200);
    const resetHtml = vi.mocked(sendEmail).mock.calls[0]?.[0].html ?? "";
    const token = resetHtml.match(/\/reset-password\/([^?"&]+)/)?.[1];
    expect(token).toBeTruthy();

    const reset = await request(app).post("/api/auth/reset-password")
      .send({ token, newPassword: "new-reset-password-123" });
    expect(reset.status).toBe(200);
    expect((await request(app).get("/v1/me").set("Cookie", registered.cookie)).status).toBe(401);
    expect((await request(app).get("/v1/me").set("Cookie", secondCookie)).status).toBe(401);
  });
});
