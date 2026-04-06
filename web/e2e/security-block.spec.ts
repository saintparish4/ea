/**
 * E2E Flow 2: Security plugin blocks signing
 *
 * Sends to a known-blocked address from the phishing plugin's threat list.
 * Verifies the blocked state is shown and Confirm & sign is absent.
 */
import { test, expect } from "@playwright/test";
import { DEV_WALLET_BC1, stubDevWalletUtxos } from "./helpers/esplora-mock";

const BASE_URL = "http://localhost:3000";

// Must match a valid entry in plugins/phishing/src/threatList.ts (valid on-chain address)
const BLOCKED_ADDRESS = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

test.describe("Send flow — security block", () => {
  test.beforeEach(async ({ page }) => {
    await stubDevWalletUtxos(page);
  });

  test("sending to a blocked address shows the Transaction blocked banner", async ({ page }) => {
    await page.goto(`${BASE_URL}/send`);

    await page.selectOption("#chain", "bitcoin");
    await page.fill("#from", DEV_WALLET_BC1);
    await page.fill("#to", BLOCKED_ADDRESS);
    await page.fill("#amount", "10000");
    await page.click("button[type='submit']");

    // Should transition to blocked state
    await expect(page.getByText(/transaction blocked/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/threat list/i)).toBeVisible();
  });

  test("Confirm & sign button is not present when blocked", async ({ page }) => {
    await page.goto(`${BASE_URL}/send`);

    await page.selectOption("#chain", "bitcoin");
    await page.fill("#from", DEV_WALLET_BC1);
    await page.fill("#to", BLOCKED_ADDRESS);
    await page.fill("#amount", "10000");
    await page.click("button[type='submit']");

    await expect(page.getByText(/transaction blocked/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /confirm & sign/i })).not.toBeVisible();
  });

  test("Dismiss button on blocked screen allows starting over", async ({ page }) => {
    await page.goto(`${BASE_URL}/send`);

    await page.selectOption("#chain", "bitcoin");
    await page.fill("#from", DEV_WALLET_BC1);
    await page.fill("#to", BLOCKED_ADDRESS);
    await page.fill("#amount", "10000");
    await page.click("button[type='submit']");

    await expect(page.getByText(/transaction blocked/i)).toBeVisible({ timeout: 10_000 });
    await page.click("button:has-text('Dismiss')");

    // Should go back to the form
    await expect(page.getByRole("button", { name: /preview transaction/i })).toBeVisible();
  });
});
