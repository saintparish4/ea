import { ok, err } from "@ea/types";
import type { Result, PluginError } from "@ea/types";
import type { Account, SignablePayload, Signature } from "@ea/types";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PublicKey {
  chain: string;
  accountIndex: number;
  /** Compressed public key as a lowercase hex string. */
  hex: string;
}

/**
 * KeyProvider is the only entity that can sign.  Plugins never receive a
 * KeyProvider reference — they call `requestSigning(payload)` which routes
 * through the pipeline, which calls KeyProvider.sign() outside the sandbox.
 */
export interface KeyProvider {
  getPublicKey(chain: string, accountIndex: number): Promise<Result<PublicKey, PluginError>>;
  sign(chain: string, payload: SignablePayload): Promise<Result<Signature, PluginError>>;
  deriveAccount(chain: string, path: string): Promise<Result<Account, PluginError>>;
}

// ---------------------------------------------------------------------------
// AES-256-GCM encrypted in-memory implementation
// ---------------------------------------------------------------------------

interface EncryptedSeed {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  salt: Uint8Array<ArrayBuffer>;
}

async function deriveSeedKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptSeed(seedPhrase: string, passphrase: string): Promise<EncryptedSeed> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSeedKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(seedPhrase),
  );
  return { ciphertext: new Uint8Array(ciphertext), iv, salt };
}

async function decryptSeed(encrypted: EncryptedSeed, passphrase: string): Promise<string> {
  const key = await deriveSeedKey(passphrase, encrypted.salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encrypted.iv },
    key,
    encrypted.ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * InMemoryKeyProvider stores the seed phrase encrypted at rest (AES-256-GCM).
 * The passphrase is held in memory only for the lifetime of this instance.
 *
 * Key derivation (BIP32/44/84) is intentionally left as a stub here — chain
 * plugins supply the derivation path and the concrete signing logic lives in
 * packages/runtime when integrated with bitcoinjs-lib / @noble/secp256k1.
 */
export class InMemoryKeyProvider implements KeyProvider {
  private encrypted: EncryptedSeed | null = null;
  private passphrase: string | null = null;

  /** Must be called once before any key operations. */
  async initialize(seedPhrase: string, passphrase: string): Promise<void> {
    this.encrypted = await encryptSeed(seedPhrase, passphrase);
    this.passphrase = passphrase;
  }

  private async getSeed(): Promise<Result<string, PluginError>> {
    if (this.encrypted === null || this.passphrase === null) {
      return err({
        code: "PLUGIN_ERROR",
        message: "KeyProvider is not initialized — call initialize() first",
        pluginId: "system",
      });
    }
    try {
      const seed = await decryptSeed(this.encrypted, this.passphrase);
      return ok(seed);
    } catch (cause) {
      return err({
        code: "PLUGIN_ERROR",
        message: "Failed to decrypt seed — wrong passphrase?",
        pluginId: "system",
        ...(cause instanceof Error ? { cause } : {}),
      });
    }
  }

  async getPublicKey(chain: string, accountIndex: number): Promise<Result<PublicKey, PluginError>> {
    const seedResult = await this.getSeed();
    if (!seedResult.ok) return seedResult;

    // TODO: derive via BIP32 using the seed + chain-specific coin type
    // Returning a zero-key stub until chain-specific derivation is wired up.
    return ok({
      chain,
      accountIndex,
      hex: "0".repeat(66), // 33-byte compressed pubkey placeholder
    });
  }

  async sign(chain: string, _payload: SignablePayload): Promise<Result<Signature, PluginError>> {
    const seedResult = await this.getSeed();
    if (!seedResult.ok) return seedResult;

    // TODO: derive private key for (chain, payload.metadata.accountIndex) and sign
    return ok({ chain, data: new Uint8Array(64) });
  }

  async deriveAccount(chain: string, path: string): Promise<Result<Account, PluginError>> {
    const seedResult = await this.getSeed();
    if (!seedResult.ok) return seedResult;

    // TODO: BIP32 derivation from path
    return ok({
      address: `${chain}:stub:${path}`,
      chain,
      accountIndex: 0,
    });
  }
}
