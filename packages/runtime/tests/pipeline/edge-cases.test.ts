/**
 * Pipeline Edge Case Tests
 *
 * 8 scenarios covering the signing pipeline's robustness:
 *   1.  Security plugin crashes → others still run; block from second plugin halts signing
 *   2.  Simulation times out → pipeline returns TimeoutError
 *   3.  One warns, one blocks → block wins
 *   4.  Plugin returns err result → PluginError propagated
 *   5.  Security plugin has enabled:false → filtered out before security checks
 *   6.  Chain plugin has no simulateTransaction → simulation stage skipped
 *   7.  No security plugins → signing proceeds after simulation
 *   8.  Concurrent signing requests → no cross-contamination in auditEntries
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { SigningPipeline } from "../../src/pipeline.js";
import type { KeyProvider } from "../../src/key-provider.js";
import type { PluginRecord } from "../../src/loader.js";
import type {
  ChainPlugin,
  SecurityPlugin,
  PluginManifest,
  TxParams,
  UnsignedTx,
  SimulationResult,
  PreSignContext,
  Result,
  PluginError,
  SecurityCheckResult,
} from "@ea/types";
import { ok, err } from "@ea/types";

// Fixtures

const CHAIN_MANIFEST: PluginManifest = {
  id: "mock-chain",
  version: "0.1.0",
  name: "Mock Chain",
  type: "chain",
  permissions: ["transactions:build", "transactions:simulate"],
  endowments: [],
  supportedChains: ["testchain"],
  capabilities: ["AccountProvider", "TransactionBuilder", "TransactionSimulator"],
  entryPoint: "index.js",
};

const SEC_MANIFEST = (id: string): PluginManifest => ({
  id,
  version: "0.1.0",
  name: `Mock Security ${id}`,
  type: "security",
  permissions: [],
  endowments: [],
  capabilities: ["SecurityPlugin"],
  entryPoint: "index.js",
});

const MOCK_TX: UnsignedTx = {
  chain: "testchain",
  raw: new Uint8Array([1, 2, 3]),
  metadata: { from: "addr-from", to: "addr-to", amount: "1000", fee: "50" },
};

const MOCK_SIMULATION: SimulationResult = {
  fee: 50n,
  feeSymbol: "TEST",
  inputs: [{ address: "addr-from", amount: 1050n, symbol: "TEST" }],
  outputs: [{ address: "addr-to", amount: 1000n, symbol: "TEST" }],
  sideEffects: ["Transfer 1000 TEST"],
  warnings: [],
};

const TX_PARAMS: TxParams = {
  from: "addr-from",
  to: "addr-to",
  amount: 1000n,
  chain: "testchain",
};

// Builder Helpers

function makeChainRecord(
  overrides: Partial<ChainPlugin> = {},
): PluginRecord & { instance: ChainPlugin } {
  const instance: ChainPlugin = {
    getAccounts: vi.fn().mockResolvedValue(ok([])),
    getBalance: vi.fn().mockResolvedValue(ok({ amount: 0n, decimals: 8, symbol: "TEST" })),
    buildTransaction: vi.fn().mockResolvedValue(ok(MOCK_TX)),
    simulateTransaction: vi.fn().mockResolvedValue(ok(MOCK_SIMULATION)),
    ...overrides,
  };
  return { manifest: CHAIN_MANIFEST, instance, enabled: true, loadedAt: Date.now() };
}

function makeSecurityRecord(
  id: string,
  overrides: Partial<SecurityPlugin> = {},
  enabled = true,
): PluginRecord & { instance: SecurityPlugin } {
  const instance: SecurityPlugin = {
    onPreSign: vi
      .fn()
      .mockResolvedValue(ok({ action: "allow", message: "OK" } as SecurityCheckResult)),
    ...overrides,
  };
  return { manifest: SEC_MANIFEST(id), instance, enabled, loadedAt: Date.now() };
}

function makeKeyProvider(): KeyProvider {
  return {
    getPublicKey: vi
      .fn()
      .mockResolvedValue(ok({ chain: "testchain", accountIndex: 0, hex: "0".repeat(66) })),
    sign: vi.fn().mockResolvedValue(ok({ chain: "testchain", data: new Uint8Array(64) })),
    deriveAccount: vi
      .fn()
      .mockResolvedValue(ok({ address: "stub-addr", chain: "testchain", accountIndex: 0 })),
  };
}

// Tests

describe("security plugin crash; block from second plugin still halts signing", () => {
  it("crashing plugin is skipped via allSettled; blocking plugin halts the pipeline", async () => {
    const pipeline = new SigningPipeline({ securityCheckTimeoutMs: 500 });
    const keyProvider = makeKeyProvider();
    const chainRecord = makeChainRecord();

    // Plugin A: returns err (simulates a crash / malfunction)
    const crashingPlugin = makeSecurityRecord("sec-crash", {
      onPreSign: vi
        .fn()
        .mockResolvedValue(
          err({
            code: "PLUGIN_ERROR",
            message: "Plugin internal error",
            pluginId: "sec-crash",
          } as PluginError),
        ),
    });

    // Plugin B: blocks
    const blockingPlugin = makeSecurityRecord("sec-block", {
      onPreSign: vi
        .fn()
        .mockResolvedValue(
          ok({ action: "block", message: "Destination is blacklisted" } as SecurityCheckResult),
        ),
    });

    const result = await pipeline.execute(
      TX_PARAMS,
      chainRecord,
      [crashingPlugin, blockingPlugin],
      keyProvider,
      "s1",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SECURITY_BLOCK_ERROR");
    }

    // Both plugins attempted onPreSign
    expect(crashingPlugin.instance.onPreSign).toHaveBeenCalledOnce();
    expect(blockingPlugin.instance.onPreSign).toHaveBeenCalledOnce();
  });
});

describe("simulation timeout returns TimeoutError", () => {
  it("pipeline returns TimeoutError when simulateTransaction hangs", async () => {
    // Use a 50 ms simulation timeout — the mock never resolves
    const pipeline = new SigningPipeline({ simulationTimeoutMs: 50 });
    const keyProvider = makeKeyProvider();

    const hangingChain = makeChainRecord({
      simulateTransaction: vi.fn().mockReturnValue(
        new Promise(() => {
          /* never resolves */
        }),
      ),
    });

    const result = await pipeline.execute(TX_PARAMS, hangingChain, [], keyProvider, "s2");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TIMEOUT_ERROR");
    }
  }, 3_000);
});

describe("warn + block: block takes priority", () => {
  it("one plugin warns, one blocks — pipeline returns SecurityBlockError; warning not surfaced", async () => {
    const pipeline = new SigningPipeline({ securityCheckTimeoutMs: 500 });
    const keyProvider = makeKeyProvider();
    const chainRecord = makeChainRecord();

    const warningPlugin = makeSecurityRecord("sec-warn", {
      onPreSign: vi
        .fn()
        .mockResolvedValue(
          ok({ action: "warn", message: "Suspicious pattern detected" } as SecurityCheckResult),
        ),
    });
    const blockingPlugin = makeSecurityRecord("sec-block2", {
      onPreSign: vi
        .fn()
        .mockResolvedValue(
          ok({
            action: "block",
            message: "Address on threat list",
            details: "Known scam address",
          } as SecurityCheckResult),
        ),
    });

    const result = await pipeline.execute(
      TX_PARAMS,
      chainRecord,
      [warningPlugin, blockingPlugin],
      keyProvider,
      "s3",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SECURITY_BLOCK_ERROR");
      expect((result.error as { reason: string }).reason).toContain("Known scam address");
    }
  });
});

describe("plugin returns err from buildTransaction", () => {
  it("PluginError from buildTransaction is propagated as the pipeline result", async () => {
    const pipeline = new SigningPipeline();
    const keyProvider = makeKeyProvider();

    const failingChain = makeChainRecord({
      buildTransaction: vi
        .fn()
        .mockResolvedValue(
          err({
            code: "PLUGIN_ERROR",
            message: "Insufficient UTXOs",
            pluginId: "mock-chain",
          } as PluginError),
        ),
    });

    const result = await pipeline.execute(TX_PARAMS, failingChain, [], keyProvider, "s4");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLUGIN_ERROR");
      expect(result.error.message).toMatch(/Insufficient UTXOs/);
    }
  });
});

describe("disabled security plugin is skipped", () => {
  it("plugin with enabled:false is filtered before security checks — its onPreSign is never called", async () => {
    const pipeline = new SigningPipeline();
    const keyProvider = makeKeyProvider();
    const chainRecord = makeChainRecord();

    // enabled:false passed directly — simulates registry returning a disabled record
    const disabledPlugin = makeSecurityRecord(
      "sec-disabled",
      {
        onPreSign: vi
          .fn()
          .mockResolvedValue(
            ok({ action: "block", message: "Should never be called" } as SecurityCheckResult),
          ),
      },
      false /* enabled = false */,
    );

    const result = await pipeline.execute(
      TX_PARAMS,
      chainRecord,
      [disabledPlugin],
      keyProvider,
      "s5",
    );

    // Pipeline should succeed because the disabled plugin was filtered
    expect(result.ok).toBe(true);
    expect(disabledPlugin.instance.onPreSign).not.toHaveBeenCalled();
  });
});

describe("missing simulateTransaction capability — stage skipped", () => {
  it("pipeline skips simulation and proceeds to signing when plugin has no simulateTransaction", async () => {
    const pipeline = new SigningPipeline();
    const keyProvider = makeKeyProvider();

    // Explicitly remove simulateTransaction from the mock
    const noSimChain = makeChainRecord({ simulateTransaction: undefined });
    // TypeScript: cast to remove the optional prop for testing
    delete (noSimChain.instance as Partial<ChainPlugin>).simulateTransaction;

    const result = await pipeline.execute(TX_PARAMS, noSimChain, [], keyProvider, "s6");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.simulation).toBeUndefined();
      expect(result.value.signature).toBeDefined();
      // Audit entries: build + sign (no simulate entry)
      const stages = result.value.auditEntries.map((e) => e.stage);
      expect(stages).not.toContain("simulate");
      expect(stages).toContain("build");
      expect(stages).toContain("sign");
    }
  });
});

describe("no security plugins — signing proceeds with simulation only", () => {
  it("empty securityPlugins array — pipeline completes build → simulate → sign", async () => {
    const pipeline = new SigningPipeline();
    const keyProvider = makeKeyProvider();
    const chainRecord = makeChainRecord();

    const result = await pipeline.execute(
      TX_PARAMS,
      chainRecord,
      [] /* no security */,
      keyProvider,
      "s7",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.simulation).toBeDefined();
      expect(result.value.signature.data).toHaveLength(64);
      expect(result.value.warnings).toHaveLength(0);
    }
  });
});

describe("concurrent signing requests — no cross-contamination", () => {
  it("two concurrent pipeline.execute calls each get their own auditEntries and sessionId", async () => {
    const pipeline = new SigningPipeline();

    const chainA = makeChainRecord();
    const chainB = makeChainRecord({
      buildTransaction: vi.fn().mockResolvedValue(
        ok({
          ...MOCK_TX,
          metadata: { from: "addr-b-from", to: "addr-b-to", amount: "9999", fee: "10" },
        }),
      ),
    });
    const kpA = makeKeyProvider();
    const kpB = makeKeyProvider();

    const [resultA, resultB] = await Promise.all([
      pipeline.execute({ ...TX_PARAMS, from: "addr-from" }, chainA, [], kpA, "session-A"),
      pipeline.execute(
        { ...TX_PARAMS, from: "addr-b-from", to: "addr-b-to", amount: 9999n },
        chainB,
        [],
        kpB,
        "session-B",
      ),
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);

    if (resultA.ok && resultB.ok) {
      // Audit entries must belong to the correct session
      const aEntries = resultA.value.auditEntries;
      const bEntries = resultB.value.auditEntries;

      aEntries.forEach((e) => expect(e.sessionId).toBe("session-A"));
      bEntries.forEach((e) => expect(e.sessionId).toBe("session-B"));

      // No shared entries between the two results
      const aIds = new Set(aEntries.map((e) => e.id));
      bEntries.forEach((e) => expect(aIds.has(e.id)).toBe(false));
    }
  });
});

describe("audit completeness across pipeline stages", () => {
  it("each completed stage produces an AuditEntry with correct fields", async () => {
    const auditLog: import("@ea/types").AuditEntry[] = [];
    const pipeline = new SigningPipeline({
      onAudit: (entry) => auditLog.push(entry),
    });
    const chainRecord = makeChainRecord();
    const secPlugin = makeSecurityRecord("sec-allow");
    const kp = makeKeyProvider();

    const result = await pipeline.execute(TX_PARAMS, chainRecord, [secPlugin], kp, "audit-test");
    expect(result.ok).toBe(true);

    // Must have entries for: build, simulate, security-check, sign
    const stages = auditLog.map((e) => e.stage);
    expect(stages).toContain("build");
    expect(stages).toContain("simulate");
    expect(stages).toContain("security-check");
    expect(stages).toContain("sign");

    // Every entry must have mandatory fields
    for (const entry of auditLog) {
      expect(entry.id).toMatch(/^[0-9a-f-]{36}$/); // UUID
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);
      expect(entry.sessionId).toBe("audit-test");
      expect(["ok", "error"]).toContain(entry.result);
    }

    // onAudit callback and auditEntries in result must be consistent
    expect(result.ok && result.value.auditEntries.length).toBe(auditLog.length);
  });
});
