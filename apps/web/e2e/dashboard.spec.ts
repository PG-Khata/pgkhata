import { test, expect } from "@playwright/test";
import { PG_ONE } from "./constants";

test("authenticated owner reaches the dashboard with their PG in scope", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  // The header PG selector shows one of the seeded properties (single-PG scope).
  await expect(page.getByText(PG_ONE, { exact: false }).first()).toBeVisible();
});
