/**
 * E2E Flow 1: Full send flow with simulation and approval
 *
 * Prerequisite: `pnpm dev` running at http://localhost:3000
 * To run: `pnpm --filter web test:e2e` or `npx playwright test e2e/send-flow.spec.ts`
 */
import { test, expect } from "@playwright/test";
import { DEV_WALLET_BC1, stubDevWalletUtxos } from "./helpers/esplora-mock";

const BASE_URL = "http://localhost:3000";

/** Valid recipient (not on threat list) for happy-path E2E. */
const LEGIT_TO = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";

test.describe("Send flow — simulation and approval", () => {
  test.beforeEach(async ({ page }) => {
    await stubDevWalletUtxos(page);
    await page.goto(`${BASE_URL}/send`);
  });

  test("shows the send form on /send", async ({ page }) => {
    await expect(page.getByLabel(/chain/i)).toBeVisible();
    await expect(page.getByLabel(/from address/i)).toBeVisible();
    await expect(page.getByLabel(/to address/i)).toBeVisible();
    await expect(page.getByLabel(/amount/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /preview transaction/i })).toBeVisible();
  });

  test("filling form and submitting transitions to simulation confirmation", async ({ page }) => {
    await page.selectOption("#chain", "bitcoin");
    await page.fill("#from", DEV_WALLET_BC1);
    await page.fill("#to", LEGIT_TO);
    await page.fill("#amount", "100000");

    await page.click("button[type='submit']");

    // Loading state: button changes to "Simulating…"
    await expect(page.getByRole("button", { name: /simulating/i })).toBeVisible();

    // After simulation, confirmation screen should appear
    await expect(page.getByText(/transaction preview/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/network fee/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm & sign/i })).toBeVisible();
  });

  test("approving the transaction transitions to 'Transaction sent'", async ({ page }) => {
    await page.selectOption("#chain", "bitcoin");
    await page.fill("#from", DEV_WALLET_BC1);
    await page.fill("#to", LEGIT_TO);
    await page.fill("#amount", "100000");
    await page.click("button[type='submit']");

    await expect(page.getByText(/transaction preview/i)).toBeVisible({ timeout: 10_000 });
    await page.click("button:has-text('Confirm & sign')");

    await expect(page.getByText(/transaction sent/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /new transaction/i })).toBeVisible();
  });

  test("'New transaction' button resets the form", async ({ page }) => {
    await page.selectOption("#chain", "bitcoin");
    await page.fill("#from", DEV_WALLET_BC1);
    await page.fill("#to", LEGIT_TO);
    await page.fill("#amount", "100000");
    await page.click("button[type='submit']");

    await expect(page.getByText(/transaction preview/i)).toBeVisible({ timeout: 10_000 });
    await page.click("button:has-text('Confirm & sign')");
    await expect(page.getByText(/transaction sent/i)).toBeVisible({ timeout: 5_000 });

    await page.click("button:has-text('New transaction')");
    await expect(page.getByRole("button", { name: /preview transaction/i })).toBeVisible();
  });
});
