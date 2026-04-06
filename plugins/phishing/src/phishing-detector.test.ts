/**
 * Phishing Detection Plugin unit tests
 */
import { describe, it, expect } from "vitest";
import { PhishingDetector } from "./detector.js";
import type { PreSignContext } from "@ea/types";

function makeContext(overrides: Partial<PreSignContext> = {}): PreSignContext {
  return {
    pluginId: "ea-plugin-bitcoin",
    tx: { chain: "bitcoin", raw: new Uint8Array([1]), metadata: {} },
    fromAddress: "bc1q-sender-addr",
    toAddress: "bc1q-recipient-addr",
    amount: 50_000n,
    chain: "bitcoin",
    ...overrides,
  };
}

describe("PhishingDetector.onPreSign", () => {
  const detector = new PhishingDetector();

  it("returns allow for a clean, unknown address", async () => {
    const result = await detector.onPreSign(makeContext({ toAddress: "bc1qcleanaddress" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.action).toBe("allow");
  });

  it("returns block for a known scam address in the threat list", async () => {
    const result = await detector.onPreSign(
      makeContext({ toAddress: "1ScamAddressExampleXXXXXXXXXXXXXXXX" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.action).toBe("block");
      expect(result.value.message).toContain("1ScamAddressExampleXXXXXXXXXXXXXXXX");
    }
  });

  it("returns block for the wrapped SOL address (known threat)", async () => {
    const result = await detector.onPreSign(
      makeContext({ toAddress: "So11111111111111111111111111111111111111112" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.action).toBe("block");
  });

  it("returns warn for address matching the many-leading-1s scam pattern", async () => {
    const result = await detector.onPreSign(
      makeContext({ toAddress: "11111111111cleanStuff" }), // 11+ leading 1s
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.action).toBe("warn");
  });

  it("returns warn for address matching the many-leading-zeros scam pattern", async () => {
    const result = await detector.onPreSign(
      makeContext({ toAddress: "000000legitAddr" }), // 6+ leading zeros
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.action).toBe("warn");
  });

  it("returns warn when sending to the same address as fromAddress (self-send)", async () => {
    const result = await detector.onPreSign(
      makeContext({ fromAddress: "bc1q-same-addr", toAddress: "bc1q-same-addr" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.action).toBe("warn");
      expect(result.value.message).toMatch(/sender/i);
    }
  });

  it("returns warn when toAddress is one of senderAccounts", async () => {
    const result = await detector.onPreSign(
      makeContext({
        toAddress: "bc1q-my-second-wallet",
        senderAccounts: [{ address: "bc1q-my-second-wallet", chain: "bitcoin", accountIndex: 1 }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.action).toBe("warn");
  });

  it("returns allow when senderAccounts is defined but toAddress is not in it", async () => {
    const result = await detector.onPreSign(
      makeContext({
        toAddress: "bc1q-someone-else",
        senderAccounts: [{ address: "bc1q-my-wallet", chain: "bitcoin", accountIndex: 0 }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.action).toBe("allow");
  });
});
