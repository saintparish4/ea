/**
 *  InMemoryKeyProvider unit tests
 */
import { describe, it, expect } from "vitest";
import { InMemoryKeyProvider } from "../src/key-provider.js";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_PASSPHRASE = "test-passphrase-123";

describe("InMemoryKeyProvider", () => {
  describe("initialization guard", () => {
    it("getPublicKey before initialize returns PLUGIN_ERROR", async () => {
      const kp = new InMemoryKeyProvider();
      const result = await kp.getPublicKey("bitcoin", 0);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("PLUGIN_ERROR");
    });

    it("sign before initialize returns PLUGIN_ERROR", async () => {
      const kp = new InMemoryKeyProvider();
      const result = await kp.sign("bitcoin", {
        chain: "bitcoin",
        data: new Uint8Array(32),
        metadata: {},
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("PLUGIN_ERROR");
    });

    it("deriveAccount before initialize returns PLUGIN_ERROR", async () => {
      const kp = new InMemoryKeyProvider();
      const result = await kp.deriveAccount("bitcoin", "m/84'/0'/0'/0/0");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("PLUGIN_ERROR");
    });
  });

  describe("after initialization", () => {
    it("getPublicKey returns a 66-char hex string (compressed pubkey stub)", async () => {
      const kp = new InMemoryKeyProvider();
      await kp.initialize(TEST_MNEMONIC, TEST_PASSPHRASE);

      const result = await kp.getPublicKey("bitcoin", 0);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hex).toHaveLength(66);
        expect(result.value.chain).toBe("bitcoin");
        expect(result.value.accountIndex).toBe(0);
      }
    });

    it("sign returns a 64-byte signature stub", async () => {
      const kp = new InMemoryKeyProvider();
      await kp.initialize(TEST_MNEMONIC, TEST_PASSPHRASE);

      const result = await kp.sign("bitcoin", {
        chain: "bitcoin",
        data: new Uint8Array(32).fill(0xab),
        metadata: {},
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data).toHaveLength(64);
        expect(result.value.chain).toBe("bitcoin");
      }
    });

    it("deriveAccount returns a stub account with the requested chain and path", async () => {
      const kp = new InMemoryKeyProvider();
      await kp.initialize(TEST_MNEMONIC, TEST_PASSPHRASE);

      const result = await kp.deriveAccount("bitcoin", "m/84'/0'/0'/0/0");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.chain).toBe("bitcoin");
        expect(result.value.address).toContain("bitcoin");
      }
    });

    it("getPublicKey is deterministic for the same (chain, accountIndex)", async () => {
      const kp = new InMemoryKeyProvider();
      await kp.initialize(TEST_MNEMONIC, TEST_PASSPHRASE);

      const r1 = await kp.getPublicKey("bitcoin", 0);
      const r2 = await kp.getPublicKey("bitcoin", 0);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (r1.ok && r2.ok) expect(r1.value.hex).toBe(r2.value.hex);
    });

    it("two separate instances with the same seed+passphrase are independent", async () => {
      const kp1 = new InMemoryKeyProvider();
      const kp2 = new InMemoryKeyProvider();
      await kp1.initialize(TEST_MNEMONIC, TEST_PASSPHRASE);
      await kp2.initialize(TEST_MNEMONIC, TEST_PASSPHRASE);

      const [r1, r2] = await Promise.all([
        kp1.getPublicKey("bitcoin", 0),
        kp2.getPublicKey("bitcoin", 0),
      ]);
      expect(r1.ok && r2.ok).toBe(true);
      if (r1.ok && r2.ok) expect(r1.value.hex).toBe(r2.value.hex);
    });
  });
});
