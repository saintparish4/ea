import type { AuditEntry } from "@ea/types";

/** Newest first (matches store list order after seed). */
export const sampleAuditEntries: readonly AuditEntry[] = [
  {
    id: "sample-01",
    timestamp: Date.now() - 2 * 60_000,
    pluginId: "chain-ethereum-v3",
    operation: "sign",
    stage: "sign",
    sessionId: "ses_demo_k8m2nq",
    durationMs: 128,
    result: "ok",
    input: {
      txHashPreview: "0x7f3a…c21d",
      chainId: 1,
      accountIndex: 0,
    },
    output: {
      signed: true,
      signatureFormat: "eth_signTypedData_v4",
    },
  },
  {
    id: "sample-02",
    timestamp: Date.now() - 5 * 60_000,
    pluginId: "billing-gateway-stripe",
    operation: "simulateTransaction",
    stage: "simulate",
    sessionId: "ses_demo_k8m2nq",
    durationMs: 5041,
    result: "error",
    errorCode: "upstream_timeout",
    input: {
      endpoint: "https://api.stripe.com/v1/charges",
      method: "POST",
      timeoutMs: 5000,
    },
    output: {
      error: "ETIMEDOUT",
      retryable: true,
    },
  },
  {
    id: "sample-03",
    timestamp: Date.now() - 8 * 60_000,
    pluginId: "user-service",
    operation: "getBalance",
    stage: "security-check",
    sessionId: "ses_demo_k8m2nq",
    durationMs: 18,
    result: "ok",
    input: {
      address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      asset: "ETH",
    },
    output: {
      balanceWei: "1250000000000000000",
      cacheHit: true,
    },
  },
  {
    id: "sample-04",
    timestamp: Date.now() - 12 * 60_000,
    pluginId: "chain-ethereum-v3",
    operation: "buildTransaction",
    stage: "build",
    sessionId: "ses_demo_k8m2nq",
    durationMs: 64,
    result: "ok",
    input: {
      to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      value: "0",
      data: "0xa9059cbb…",
    },
    output: {
      unsignedTx: { nonce: 42, gasLimit: "0x5208", maxFeePerGas: "0x3b9aca00" },
    },
  },
  {
    id: "sample-05",
    timestamp: Date.now() - 15 * 60_000,
    pluginId: "security-plugin-hsm",
    operation: "onPostSign",
    stage: "post-sign",
    sessionId: "ses_demo_k8m2nq",
    durationMs: 9,
    result: "ok",
    input: {
      pluginVersion: "2.1.0",
    },
    output: {
      auditTag: "post_sign_ok",
    },
  },
  {
    id: "sample-06",
    timestamp: Date.now() - 20 * 60_000,
    pluginId: "loader",
    operation: "loadPlugin",
    stage: "loader",
    sessionId: "ses_demo_k8m2nq",
    durationMs: 240,
    result: "ok",
    input: {
      manifestId: "chain-ethereum-v3",
      source: "embedded",
    },
    output: {
      loaded: true,
      capabilities: ["buildTransaction", "simulateTransaction", "sign"],
    },
  },
];
