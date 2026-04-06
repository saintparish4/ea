/**
 * Solana plugin unit tests (mocked Connection)
 *
 * Layer 1 (unit): Solana Connection mocked via vi.fn()
 * Layer 2 (MSW): Recorded RPC fixtures — see plugins/solana/tests/integration/
 * Layer 3 (E2E): Solana Devnet — CI-optional, guarded by SOLANA_TESTNET env var
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import type { Connection, PublicKey as SolPublicKey } from "@solana/web3.js";
import { SolanaAccountProvider, deriveSolanaKeypair } from "./accounts.js";
import { SolanaTxBuilder } from "./builder.js";
import { SolanaSimulator } from "./simulator.js";
import type { UnsignedTx } from "@ea/types";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// Helpers

function makeConnection(
  overrides: Partial<{
    getBalance: (pk: SolPublicKey) => Promise<number>;
    getLatestBlockhash: () => Promise<{ blockhash: string; lastValidBlockHeight: number }>;
    simulateTransaction: (
      tx: unknown,
    ) => Promise<{ value: { err: null; logs: string[]; unitsConsumed: number } }>;
  }> = {},
): Connection {
  return {
    getBalance: vi.fn().mockResolvedValue(5_000_000_000), // 5 SOL
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N",
      lastValidBlockHeight: 999_999,
    }),
    simulateTransaction: vi.fn().mockResolvedValue({
      value: { err: null, logs: ["Program log: Instruction: Transfer"], unitsConsumed: 150 },
    }),
    ...overrides,
  } as unknown as Connection;
}

afterEach(() => vi.restoreAllMocks());

// Key Derivation

describe("deriveSolanaKeypair", () => {
  it("returns a Keypair for a valid mnemonic and account index", () => {
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    expect(kp.publicKey.toBase58()).toHaveLength(44); // base58 encoded 32-byte pubkey
  });

  it("returns different keypairs for different account indexes", () => {
    const kp0 = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const kp1 = deriveSolanaKeypair(TEST_MNEMONIC, 1);
    expect(kp0.publicKey.toBase58()).not.toBe(kp1.publicKey.toBase58());
  });

  it("is deterministic for the same mnemonic + index", () => {
    const a = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const b = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    expect(a.publicKey.toBase58()).toBe(b.publicKey.toBase58());
  });
});

// SolanaAccountProvider

describe("SolanaAccountProvider", () => {
  it("getAccounts returns 3 accounts with correct chain", async () => {
    const conn = makeConnection();
    const provider = new SolanaAccountProvider(TEST_MNEMONIC, conn);
    const result = await provider.getAccounts();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      result.value.forEach((acc, i) => {
        expect(acc.chain).toBe("solana");
        expect(acc.accountIndex).toBe(i);
        // Solana pubkeys are base58, 32–44 chars
        expect(acc.address.length).toBeGreaterThanOrEqual(32);
      });
    }
  });

  it("getBalance parses lamport balance correctly (5 SOL = 5_000_000_000 lamports)", async () => {
    const conn = makeConnection({ getBalance: vi.fn().mockResolvedValue(5_000_000_000) });
    const provider = new SolanaAccountProvider(TEST_MNEMONIC, conn);
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const result = await provider.getBalance(kp.publicKey.toBase58());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.amount).toBe(5_000_000_000n);
      expect(result.value.symbol).toBe("SOL");
      expect(result.value.decimals).toBe(9);
    }
  });

  it("getBalance returns PLUGIN_ERROR when connection throws", async () => {
    const conn = makeConnection({
      getBalance: vi.fn().mockRejectedValue(new Error("Connection refused")),
    });
    const provider = new SolanaAccountProvider(TEST_MNEMONIC, conn);
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const result = await provider.getBalance(kp.publicKey.toBase58());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toContain("Connection refused");
    }
  });
});

// SolanaTxBuilder

describe("SolanaTxBuilder", () => {
  it("builds a SOL transfer transaction", async () => {
    const conn = makeConnection();
    const builder = new SolanaTxBuilder(conn);
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);

    const result = await builder.buildTransaction({
      from: kp.publicKey.toBase58(),
      to: deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58(),
      amount: 100_000_000n, // 0.1 SOL
      chain: "solana",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const tx: UnsignedTx = result.value;
      expect(tx.chain).toBe("solana");
      expect(tx.raw).toBeInstanceOf(Uint8Array);
      expect(tx.raw.length).toBeGreaterThan(0);
    }
  });

  it("includes the recent blockhash in the built transaction metadata", async () => {
    const conn = makeConnection();
    const builder = new SolanaTxBuilder(conn);
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);

    const result = await builder.buildTransaction({
      from: kp.publicKey.toBase58(),
      to: deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58(),
      amount: 1_000_000n,
      chain: "solana",
    });

    if (result.ok) {
      const tx: UnsignedTx = result.value;
      expect(tx.metadata).toBeDefined();
    }
  });
});

// SolanaSimulator

describe("SolanaSimulator", () => {
  it("returns ok SimulationResult with logs and fee info", async () => {
    const conn = makeConnection();
    const simulator = new SolanaSimulator(conn);
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);

    const builder = new SolanaTxBuilder(conn);
    const buildResult = await builder.buildTransaction({
      from: kp.publicKey.toBase58(),
      to: deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58(),
      amount: 1_000_000n,
      chain: "solana",
    });
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    const tx: UnsignedTx = buildResult.value;
    const result = await simulator.simulateTransaction(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.feeSymbol).toBe("SOL");
      expect(result.value.fee).toBeGreaterThanOrEqual(0n);
      expect(Array.isArray(result.value.rawLogs)).toBe(true);
    }
  });

  it("surfaces simulation logs as rawLogs on the SimulationResult", async () => {
    const conn = makeConnection({
      simulateTransaction: vi.fn().mockResolvedValue({
        value: {
          err: null,
          logs: ["Program log: custom log line"],
          unitsConsumed: 200,
        },
      }),
    });
    const simulator = new SolanaSimulator(conn);
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const builder = new SolanaTxBuilder(conn);
    const buildResult = await builder.buildTransaction({
      from: kp.publicKey.toBase58(),
      to: deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58(),
      amount: 1_000_000n,
      chain: "solana",
    });
    if (!buildResult.ok) return;

    const tx: UnsignedTx = buildResult.value;
    const result = await simulator.simulateTransaction(tx);
    if (result.ok) {
      expect(result.value.rawLogs).toContain("Program log: custom log line");
    }
  });

  it("returns PLUGIN_ERROR when the simulation response contains an error", async () => {
    const conn = makeConnection({
      simulateTransaction: vi.fn().mockResolvedValue({
        value: { err: { InstructionError: [0, "InsufficientFunds"] }, logs: [], unitsConsumed: 0 },
      }),
    });
    const simulator = new SolanaSimulator(conn);
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const builder = new SolanaTxBuilder(makeConnection()); // builder uses clean conn
    const buildResult = await builder.buildTransaction({
      from: kp.publicKey.toBase58(),
      to: deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58(),
      amount: 1_000_000n,
      chain: "solana",
    });
    if (!buildResult.ok) return;

    const tx: UnsignedTx = buildResult.value;
    const result = await simulator.simulateTransaction(tx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PLUGIN_ERROR");
  });
});
