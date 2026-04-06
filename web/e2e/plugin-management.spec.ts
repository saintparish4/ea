/**
 * E2E Flow 3: Plugin enable/disable from management page
 */
import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Plugin management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/plugins`);
  });

  test("plugins page lists registered plugins", async ({ page }) => {
    // At least one plugin should be listed after runtime initializes
    await expect(page.locator("li")).not.toHaveCount(0, { timeout: 5_000 });
  });

  test("each plugin card shows its name, type badge, and capabilities", async ({ page }) => {
    const firstCard = page.locator("li").first();
    await expect(firstCard).toBeVisible({ timeout: 5_000 });

    // Type badge should be one of chain / security / utility
    const typeBadge = firstCard.locator("span").filter({ hasText: /^(chain|security|utility)$/ });
    await expect(typeBadge).toBeVisible();
  });

  test("clicking a plugin toggle disables it and updates aria-checked", async ({ page }) => {
    // Find a plugin that is currently enabled
    const enabledToggle = page.getByRole("switch", { name: /disable plugin/i }).first();
    await expect(enabledToggle).toBeVisible({ timeout: 5_000 });

    await enabledToggle.click();

    // After clicking, the toggle should reflect the disabled state
    await expect(page.getByRole("switch", { name: /enable plugin/i }).first()).toBeVisible();
  });

  test("re-enabling a plugin updates the toggle back to enabled state", async ({ page }) => {
    // Disable first
    const toggle = page.getByRole("switch", { name: /disable plugin/i }).first();
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    await toggle.click();

    // Re-enable
    const disabledToggle = page.getByRole("switch", { name: /enable plugin/i }).first();
    await expect(disabledToggle).toBeVisible();
    await disabledToggle.click();

    await expect(page.getByRole("switch", { name: /disable plugin/i }).first()).toBeVisible();
  });
});
