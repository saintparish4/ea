import type { Page } from "@playwright/test";

/**
 * Native segwit address for account 0 from the dev mnemonic used by
 * `web/app/lib/runtime.ts` and `plugins/bitcoin` — must match "from" in E2E
 * so the pipeline can build a tx after we stub UTXOs.
 */
export const DEV_WALLET_BC1 = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";

/**
 * Stub Blockstream Esplora UTXOs for the dev wallet so Bitcoin build succeeds
 * offline in Playwright (no real mainnet funds required).
 */
export async function stubDevWalletUtxos(page: Page): Promise<void> {
  const pattern = `**/address/${DEV_WALLET_BC1}/utxo`;
  await page.route(pattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          txid: "a".repeat(64),
          vout: 0,
          status: { confirmed: true, block_height: 800_000 },
          value: 100_000_000,
        },
      ]),
    });
  });
}
