import { test, expect } from "@playwright/test";
import { PG_ONE, PG_TWO } from "./constants";

test("switching the header PG selector re-scopes in place", async ({ page }) => {
  await page.goto("/dashboard");

  const trigger = page
    .getByRole("button")
    .filter({ hasText: /E2E (Primary|Secondary) PG/ })
    .first();
  await expect(trigger).toBeVisible();

  // Switch to whichever PG is NOT currently selected (order is not guaranteed).
  const current = (await trigger.textContent()) ?? "";
  const target = current.includes(PG_ONE) ? PG_TWO : PG_ONE;

  await trigger.click();
  await page.getByRole("menuitem", { name: target }).click();

  // The trigger now reflects the newly selected PG, and we stayed on the page.
  await expect(page.getByRole("button").filter({ hasText: target }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard/);
});
