/**
 * Solana plugin — Layer 2 integration tests (MSW fixtures)
 *
 * These tests create a real @solana/web3.js Connection pointed at a local stub
 * URL, then use Mock Service Worker to intercept the JSON-RPC calls that
 * Connection makes. Unlike the unit tests (Layer 1) which replace Connection
 * wholesale with vi.fn() stubs, these tests exercise the real Connection
 * construction, serialisation, and deserialization path — MSW returns recorded
 * fixture responses matching the actual Solana JSON-RPC API contract.
 *
 * RPC stub URL: http://127.0.0.1:18899 (arbitrary; never hits the network).
 */
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { Connection } from "@solana/web3.js";
import { SolanaAccountProvider, deriveSolanaKeypair } from "../../src/accounts.js";
import { SolanaTxBuilder } from "../../src/builder.js";
import { SolanaSimulator } from "../../src/simulator.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const RPC_URL = "http://127.0.0.1:18899";

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
const SLOT = 1_234_567;

// ── Fixtures ──────────────────────────────────────────────────────────────────

function rpcOk(id: unknown, result: unknown) {
  return HttpResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return HttpResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

// ── MSW server ────────────────────────────────────────────────────────────────

/** Dispatch on JSON-RPC method and return recorded fixture responses. */
const rpcHandler = http.post(RPC_URL, async ({ request }) => {
  const body = (await request.json()) as { method: string; id: unknown };

  switch (body.method) {
    case "getBalance":
      return rpcOk(body.id, {
        // web3.js validates context as { slot } only — extra keys fail superstruct.
        context: { slot: SLOT },
        value: 5_000_000_000, // 5 SOL in lamports
      });

    case "getLatestBlockhash":
      return rpcOk(body.id, {
        context: { slot: SLOT },
        value: { blockhash: BLOCKHASH, lastValidBlockHeight: SLOT + 100 },
      });

    case "simulateTransaction":
      return rpcOk(body.id, {
        context: { slot: SLOT },
        value: {
          err: null,
          accounts: null,
          logs: [
            "Program 11111111111111111111111111111111 invoke [1]",
            "Program 11111111111111111111111111111111 success",
          ],
          unitsConsumed: 150,
          returnData: null,
        },
      });

    default:
      return rpcError(body.id, -32_601, `Method not found: ${body.method}`);
  }
});

const server = setupServer(rpcHandler);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConnection(): Connection {
  // @solana/web3.js captures globalThis.fetch at import time; MSW patches fetch
  // in beforeAll after imports run. Delegate at call time so requests hit MSW.
  return new Connection(RPC_URL, {
    commitment: "confirmed",
    fetch: (input, init) => globalThis.fetch(input, init),
  });
}

// ── SolanaAccountProvider ─────────────────────────────────────────────────────

describe("SolanaAccountProvider (MSW — Solana RPC fixtures)", () => {
  it("getBalance resolves 5 SOL from fixture lamport value", async () => {
    const conn = makeConnection();
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

  it("getBalance returns PLUGIN_ERROR on RPC network failure", async () => {
    server.use(http.post(RPC_URL, () => HttpResponse.error()));

    const conn = makeConnection();
    const provider = new SolanaAccountProvider(TEST_MNEMONIC, conn);
    const kp = deriveSolanaKeypair(TEST_MNEMONIC, 0);

    const result = await provider.getBalance(kp.publicKey.toBase58());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
    }
  });
});

// ── SolanaTxBuilder ───────────────────────────────────────────────────────────

describe("SolanaTxBuilder (MSW — Solana RPC fixtures)", () => {
  it("buildTransaction fetches blockhash from RPC and serialises the transaction", async () => {
    const conn = makeConnection();
    const builder = new SolanaTxBuilder(conn);
    const from = deriveSolanaKeypair(TEST_MNEMONIC, 0).publicKey.toBase58();
    const to = deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58();

    const result = await builder.buildTransaction({
      from,
      to,
      amount: 100_000_000n, // 0.1 SOL
      chain: "solana",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chain).toBe("solana");
      expect(result.value.raw).toBeInstanceOf(Uint8Array);
      expect(result.value.raw.length).toBeGreaterThan(0);
      expect(result.value.metadata["from"]).toBe(from);
      expect(result.value.metadata["to"]).toBe(to);
    }
  });

  it("buildTransaction returns PLUGIN_ERROR when RPC returns a network error", async () => {
    server.use(http.post(RPC_URL, () => HttpResponse.error()));

    const conn = makeConnection();
    const builder = new SolanaTxBuilder(conn);
    const from = deriveSolanaKeypair(TEST_MNEMONIC, 0).publicKey.toBase58();
    const to = deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58();

    const result = await builder.buildTransaction({
      from,
      to,
      amount: 100_000_000n,
      chain: "solana",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
    }
  });
});

// ── SolanaSimulator ───────────────────────────────────────────────────────────

describe("SolanaSimulator (MSW — Solana RPC fixtures)", () => {
  it("simulateTransaction decodes fixture RPC response into a SimulationResult", async () => {
    const conn = makeConnection();
    const builder = new SolanaTxBuilder(conn);
    const simulator = new SolanaSimulator(conn);
    const from = deriveSolanaKeypair(TEST_MNEMONIC, 0).publicKey.toBase58();
    const to = deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58();

    const buildResult = await builder.buildTransaction({
      from,
      to,
      amount: 1_000_000n,
      chain: "solana",
    });
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    const result = await simulator.simulateTransaction(buildResult.value);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.feeSymbol).toBe("SOL");
      expect(result.value.fee).toBeGreaterThanOrEqual(0n);
      expect(result.value.rawLogs).toContain(
        "Program 11111111111111111111111111111111 success",
      );
    }
  });

  it("simulateTransaction returns PLUGIN_ERROR when the RPC reports a simulation error", async () => {
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        const body = (await request.json()) as { method: string; id: unknown };
        if (body.method === "simulateTransaction") {
          return rpcOk(body.id, {
            context: { slot: SLOT },
            value: {
              err: { InstructionError: [0, "InsufficientFunds"] },
              accounts: null,
              logs: [],
              unitsConsumed: 0,
              returnData: null,
            },
          });
        }
        // Pass through other methods to default handler
        if (body.method === "getLatestBlockhash") {
          return rpcOk(body.id, {
            context: { slot: SLOT },
            value: { blockhash: BLOCKHASH, lastValidBlockHeight: SLOT + 100 },
          });
        }
        return rpcError(body.id, -32_601, "Method not found");
      }),
    );

    const conn = makeConnection();
    const builder = new SolanaTxBuilder(conn);
    const simulator = new SolanaSimulator(conn);
    const from = deriveSolanaKeypair(TEST_MNEMONIC, 0).publicKey.toBase58();
    const to = deriveSolanaKeypair(TEST_MNEMONIC, 1).publicKey.toBase58();

    const buildResult = await builder.buildTransaction({
      from,
      to,
      amount: 1_000_000n,
      chain: "solana",
    });
    if (!buildResult.ok) return;

    const result = await simulator.simulateTransaction(buildResult.value);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toContain("InsufficientFunds");
    }
  });
});
