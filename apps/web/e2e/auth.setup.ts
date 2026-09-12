import { test as setup, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db, user } from "@pgkhata/db";
import { OWNER, PG_ONE, PG_TWO } from "./constants";

const authFile = "e2e/.auth/owner.json";

setup("create account, seed PGs, and authenticate", async ({ page }) => {
  // 1) Sign up directly against the API. A hand-inserted account row does NOT
  //    sign in under Better Auth, so we mint the credential the real way. Better
  //    Auth requires a trusted Origin (CSRF), which a plain API request omits —
  //    set it explicitly. Sign-up creates no session (email unverified), so it
  //    does not matter that this bypasses the same-origin proxy.
  const signUp = await page.request.post("http://localhost:3101/api/auth/sign-up/email", {
    headers: { origin: "http://localhost:3100" },
    data: { name: OWNER.name, email: OWNER.email, password: OWNER.password },
  });
  expect(signUp.ok(), `sign-up failed: ${await signUp.text()}`).toBeTruthy();

  // 2) Mark the email verified so sign-in isn't blocked (skips the OTP email).
  const updated = await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.email, OWNER.email))
    .returning({ id: user.id });
  // Same-DB guard: if this matched no row, the runner and the API are pointed at
  // different databases (the exact misconfiguration that once leaked into prod).
  expect(updated.length, "email-verify update matched no user row — runner/API DB mismatch").toBe(1);

  // 3) Log in through the real form (same-origin session cookie via the proxy).
  await page.goto("/login");
  await page.locator("#email").fill(OWNER.email);
  await page.locator("#password").fill(OWNER.password);
  await page.getByRole("button", { name: /login/i }).click();
  await page.waitForURL("**/dashboard**", { timeout: 30_000 });

  // 4) Seed two PGs so single-PG scoping and the switcher can be exercised.
  //    page.request shares the browser context's cookies, so these are authored.
  for (const name of [PG_ONE, PG_TWO]) {
    const res = await page.request.post("/api/backend/v1/properties", { data: { name } });
    expect(res.ok(), `seed PG "${name}" failed: ${await res.text()}`).toBeTruthy();
  }

  await page.context().storageState({ path: authFile });
});
