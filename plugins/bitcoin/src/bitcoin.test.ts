/**
 * Bitcoin plugin unit tests (mocked network)
 *
 * Layer 1 (unit): all RPC calls mocked via vi.stubGlobal('fetch', ...)
 * Layer 2 (MSW fixtures): see plugins/bitcoin/tests/integration/ (optional)
 * Layer 3 (E2E): Bitcoin Signet — CI-optional, guarded by BITCOIN_TESTNET env var
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { BitcoinAccountProvider, deriveP2WPKH } from "./accounts.js";
import { BitcoinTxBuilder } from "./builder.js";
import { BitcoinSimulator } from "./simulator.js";
import type { UnsignedTx } from "@ea/types";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

/** Valid mainnet P2WPKH addresses — bitcoinjs-lib rejects invalid bech32 placeholders like "bc1q-to". */
const ADDR_A = deriveP2WPKH(TEST_MNEMONIC, 0);
const ADDR_B = deriveP2WPKH(TEST_MNEMONIC, 1);
const ADDR_C = deriveP2WPKH(TEST_MNEMONIC, 2);

const MOCK_UTXOS = [
  { txid: "abcd".repeat(16), vout: 0, value: 100_000 }, // 0.001 BTC
];

const MOCK_BALANCE_RESPONSE = {
  chain_stats: { funded_txo_sum: 100_000, spent_txo_sum: 0 },
};

afterEach(() => vi.restoreAllMocks());

// Address Derivation

describe("deriveP2WPKH", () => {
  it("derives a bech32 address for account index 0 on mainnet", () => {
    const addr = deriveP2WPKH(TEST_MNEMONIC, 0);
    expect(addr).toMatch(/^bc1q/); // P2WPKH mainnet prefix
  });

  it("derives a different address for each account index", () => {
    const addr0 = deriveP2WPKH(TEST_MNEMONIC, 0);
    const addr1 = deriveP2WPKH(TEST_MNEMONIC, 1);
    expect(addr0).not.toBe(addr1);
  });

  it("derives a testnet address when testnet network is provided", () => {
    const addr = deriveP2WPKH(TEST_MNEMONIC, 0, bitcoin.networks.testnet);
    expect(addr).toMatch(/^tb1q/); // P2WPKH testnet prefix
  });

  it("is deterministic — same mnemonic + index always yields the same address", () => {
    expect(deriveP2WPKH(TEST_MNEMONIC, 0)).toBe(deriveP2WPKH(TEST_MNEMONIC, 0));
  });
});

// BitcoinAccountProvider

describe("BitcoinAccountProvider", () => {
  it("getAccounts returns 3 accounts with correct chain and accountIndex values", async () => {
    const provider = new BitcoinAccountProvider(TEST_MNEMONIC);
    const result = await provider.getAccounts();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      result.value.forEach((acc, i) => {
        expect(acc.chain).toBe("bitcoin");
        expect(acc.accountIndex).toBe(i);
        expect(acc.address).toMatch(/^bc1q/);
      });
    }
  });

  it("getBalance parses Esplora API response correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_BALANCE_RESPONSE),
      } as unknown as Response),
    );

    const provider = new BitcoinAccountProvider(TEST_MNEMONIC);
    const result = await provider.getBalance("bc1q-test-addr");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.amount).toBe(100_000n);
      expect(result.value.symbol).toBe("BTC");
      expect(result.value.decimals).toBe(8);
    }
  });

  it("getBalance returns PLUGIN_ERROR on HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      } as unknown as Response),
    );

    const provider = new BitcoinAccountProvider(TEST_MNEMONIC);
    const result = await provider.getBalance("bc1q-test-addr");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toContain("503");
    }
  });
});

// BitcoinTxBuilder

describe("BitcoinTxBuilder", () => {
  it("builds a valid PSBT when UTXOs are available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_UTXOS),
      } as unknown as Response),
    );

    const builder = new BitcoinTxBuilder();
    const result = await builder.buildTransaction({
      from: ADDR_A,
      to: ADDR_B,
      amount: 50_000n,
      chain: "bitcoin",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chain).toBe("bitcoin");
      expect(result.value.raw).toBeInstanceOf(Uint8Array);
      expect(result.value.raw.length).toBeGreaterThan(0);
      expect(result.value.metadata["from"]).toBe(ADDR_A);
      expect(result.value.metadata["to"]).toBe(ADDR_B);
    }
  });

  it("returns PLUGIN_ERROR when no UTXOs are available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as unknown as Response),
    );

    const builder = new BitcoinTxBuilder();
    const result = await builder.buildTransaction({
      from: ADDR_C,
      to: ADDR_B,
      amount: 10_000n,
      chain: "bitcoin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toMatch(/no utxos/i);
    }
  });

  it("returns PLUGIN_ERROR when input sum < amount + fee", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ txid: "ab".repeat(32), vout: 0, value: 500 }]), // only 500 sats
      } as unknown as Response),
    );

    const builder = new BitcoinTxBuilder();
    const result = await builder.buildTransaction({
      from: ADDR_C,
      to: ADDR_B,
      amount: 50_000n, // much more than 500 sats
      chain: "bitcoin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toMatch(/insufficient/i);
    }
  });

  it("fee metadata is a numeric string serialisation of BigInt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_UTXOS),
      } as unknown as Response),
    );

    const builder = new BitcoinTxBuilder();
    const result = await builder.buildTransaction({
      from: ADDR_A,
      to: ADDR_B,
      amount: 10_000n,
      chain: "bitcoin",
    });

    if (result.ok) {
      expect(typeof result.value.metadata["fee"]).toBe("string");
      // Fee = 5 sat/vB × estimated vbytes — just verify it's positive
      expect(BigInt(result.value.metadata["fee"] as string)).toBeGreaterThan(0n);
    }
  });
});

// BitcoinSimulator

describe("BitcoinSimulator", () => {
  const simulator = new BitcoinSimulator();

  function makeTx(meta: Record<string, unknown>): UnsignedTx {
    return { chain: "bitcoin", raw: new Uint8Array([1, 2, 3]), metadata: meta };
  }

  it("produces a SimulationResult with correct inputs/outputs/fee", async () => {
    const tx = makeTx({ from: "bc1q-from", to: "bc1q-to", amount: "50000", fee: "350" });
    const result = await simulator.simulateTransaction(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fee).toBe(350n);
      expect(result.value.feeSymbol).toBe("BTC");
      expect(result.value.inputs).toHaveLength(1);
      expect(result.value.outputs).toHaveLength(1);
      expect(result.value.outputs[0]!.amount).toBe(50_000n);
      expect(result.value.sideEffects.length).toBeGreaterThan(0);
      expect(result.value.warnings).toHaveLength(0);
    }
  });

  it("returns PLUGIN_ERROR when metadata is missing required fields", async () => {
    const tx = makeTx({ from: "bc1q-from" }); // no 'to', 'amount', 'fee'
    const result = await simulator.simulateTransaction(tx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toMatch(/metadata/i);
    }
  });

  it("returns PLUGIN_ERROR when amount/fee strings cannot be parsed as BigInt", async () => {
    const tx = makeTx({ from: "bc1q-from", to: "bc1q-to", amount: "not-a-number", fee: "0" });
    const result = await simulator.simulateTransaction(tx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PLUGIN_ERROR");
  });

  it("human-readable side-effect string mentions the BTC amount and destination", async () => {
    const tx = makeTx({ from: "bc1q-from", to: "bc1q-to", amount: "100000000", fee: "500" }); // 1 BTC
    const result = await simulator.simulateTransaction(tx);
    if (result.ok) {
      const sideEffect = result.value.sideEffects.join(" ");
      expect(sideEffect).toContain("bc1q-to");
      expect(sideEffect).toContain("BTC");
    }
  });
});
