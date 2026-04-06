/**
 * Bitcoin plugin — Layer 2 integration tests (MSW fixtures)
 *
 * These tests use Mock Service Worker to intercept real HTTP requests at the
 * network level. Unlike the unit tests (Layer 1) which stub `fetch` globally,
 * these tests let BitcoinAccountProvider and BitcoinTxBuilder construct their
 * own URLs and make real fetch calls — MSW intercepts and returns recorded
 * Esplora fixture responses. This verifies URL construction, request format,
 * and response parsing together.
 *
 * Fixture data is shaped to match the actual Blockstream Esplora API contract.
 */
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { BitcoinAccountProvider, deriveP2WPKH } from "../../src/accounts.js";
import { BitcoinTxBuilder } from "../../src/builder.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

/** Derived once so all tests share the same deterministic address. */
const TEST_ADDRESS = deriveP2WPKH(TEST_MNEMONIC, 0);
const TEST_RECIPIENT = deriveP2WPKH(TEST_MNEMONIC, 1);

/** Recorded Esplora /address/{addr} response (Blockstream API shape). */
const FIXTURE_ADDRESS = {
  address: TEST_ADDRESS,
  chain_stats: {
    funded_txo_count: 2,
    funded_txo_sum: 546_321,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 2,
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0,
  },
};

/** Recorded Esplora /address/{addr}/utxo response. */
const FIXTURE_UTXOS = [
  {
    // Must be exactly 64 hex chars (32 bytes) — bitcoinjs-lib rejects longer strings.
    txid: "a0b9d1e2f3c4b5a6978867504030201009897869584737261504030201009876",
    vout: 0,
    status: {
      confirmed: true,
      block_height: 800_000,
      block_hash: "00000000000000000002a7c4c1e48d76c5a37902395a7c09e3ab59d1f741afbc",
      block_time: 1_688_400_000,
    },
    value: 546_321,
  },
];

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer(
  /** Balance endpoint */
  http.get("https://blockstream.info/api/address/:address", () => {
    return HttpResponse.json(FIXTURE_ADDRESS);
  }),

  /** UTXO endpoint */
  http.get("https://blockstream.info/api/address/:address/utxo", () => {
    return HttpResponse.json(FIXTURE_UTXOS);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── BitcoinAccountProvider ────────────────────────────────────────────────────

describe("BitcoinAccountProvider (MSW — Esplora fixtures)", () => {
  it("getBalance hits the correct Esplora address endpoint and parses chain_stats", async () => {
    const provider = new BitcoinAccountProvider(TEST_MNEMONIC);
    const result = await provider.getBalance(TEST_ADDRESS);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // funded_txo_sum (546321) - spent_txo_sum (0) = 546321 sats
      expect(result.value.amount).toBe(546_321n);
      expect(result.value.symbol).toBe("BTC");
      expect(result.value.decimals).toBe(8);
    }
  });

  it("getBalance returns PLUGIN_ERROR when Esplora returns 404", async () => {
    server.use(
      http.get("https://blockstream.info/api/address/:address", () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );

    const provider = new BitcoinAccountProvider(TEST_MNEMONIC);
    const result = await provider.getBalance(TEST_ADDRESS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toContain("404");
    }
  });

  it("getBalance returns PLUGIN_ERROR on network error", async () => {
    server.use(
      http.get("https://blockstream.info/api/address/:address", () => {
        return HttpResponse.error();
      }),
    );

    const provider = new BitcoinAccountProvider(TEST_MNEMONIC);
    const result = await provider.getBalance(TEST_ADDRESS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
    }
  });
});

// ── BitcoinTxBuilder ──────────────────────────────────────────────────────────

describe("BitcoinTxBuilder (MSW — Esplora fixtures)", () => {
  it("buildTransaction hits the correct UTXO endpoint and builds a valid PSBT", async () => {
    const builder = new BitcoinTxBuilder();
    const result = await builder.buildTransaction({
      from: TEST_ADDRESS,
      to: TEST_RECIPIENT,
      amount: 100_000n,
      chain: "bitcoin",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chain).toBe("bitcoin");
      expect(result.value.raw).toBeInstanceOf(Uint8Array);
      expect(result.value.raw.length).toBeGreaterThan(0);
      expect(result.value.metadata["to"]).toBe(TEST_RECIPIENT);
    }
  });

  it("buildTransaction returns PLUGIN_ERROR when UTXO endpoint returns empty array", async () => {
    server.use(
      http.get("https://blockstream.info/api/address/:address/utxo", () => {
        return HttpResponse.json([]);
      }),
    );

    const builder = new BitcoinTxBuilder();
    const result = await builder.buildTransaction({
      from: TEST_ADDRESS,
      to: TEST_RECIPIENT,
      amount: 100_000n,
      chain: "bitcoin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toMatch(/no utxos/i);
    }
  });

  it("buildTransaction returns PLUGIN_ERROR when UTXO endpoint returns 503", async () => {
    server.use(
      http.get("https://blockstream.info/api/address/:address/utxo", () => {
        return new HttpResponse(null, { status: 503 });
      }),
    );

    const builder = new BitcoinTxBuilder();
    // builder.fetchUtxos returns [] on non-ok response → treated as no UTXOs
    const result = await builder.buildTransaction({
      from: TEST_ADDRESS,
      to: TEST_RECIPIENT,
      amount: 100_000n,
      chain: "bitcoin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
    }
  });

  it("fee in metadata is a numeric BigInt-serialisable string", async () => {
    const builder = new BitcoinTxBuilder();
    const result = await builder.buildTransaction({
      from: TEST_ADDRESS,
      to: TEST_RECIPIENT,
      amount: 50_000n,
      chain: "bitcoin",
    });

    if (result.ok) {
      const fee = result.value.metadata["fee"];
      expect(typeof fee).toBe("string");
      expect(BigInt(fee as string)).toBeGreaterThan(0n);
    }
  });
});
