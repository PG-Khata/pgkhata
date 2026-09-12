import { test, expect } from "@playwright/test";

// Run this one unauthenticated, overriding the project's stored session.
test.use({ storageState: { cookies: [], origins: [] } });

test("login page renders and rejects bad credentials", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

  await page.locator("#email").fill("nobody@pgkhata.test");
  await page.locator("#password").fill("wrong-password-123");
  await page.getByRole("button", { name: /login/i }).click();

  // Invalid credentials keep the user on the login page (toast error), never
  // through to the dashboard.
  await expect(page).toHaveURL(/\/login/);
  await expect(page).not.toHaveURL(/\/dashboard/);
});
