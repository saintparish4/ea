// Encoding helpers and address-format validators.
// These are pure functions — no keys, no signing. Crypto primitives live
// in KeyProvider (packages/runtime) where they belong.

export function isValidHex(value: string): boolean {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);
}

export function hexToBytes(hex: string): Uint8Array {
  if (!isValidHex(hex)) {
    throw new Error(`Invalid hex string (length=${hex.length})`);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidBase58(value: string): boolean {
  return value.length > 0 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

// Matches lowercase bech32 (bc1..., tb1..., sol native addresses are base58)
export function isValidBech32(value: string): boolean {
  return /^[a-z]+1[ac-hj-np-z02-9]+$/.test(value.toLowerCase());
}

export function isEthereumAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function isSolanaAddress(value: string): boolean {
  return isValidBase58(value) && value.length >= 32 && value.length <= 44;
}

export function isBitcoinAddress(value: string): boolean {
  // P2WPKH (bc1q...) or P2WSH (bc1p...) — bech32/bech32m
  if (isValidBech32(value)) return true;
  // Legacy P2PKH (1...) or P2SH (3...)
  return isValidBase58(value) && (value.startsWith("1") || value.startsWith("3"));
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
