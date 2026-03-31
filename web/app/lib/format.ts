/**
 * Utility helpers for formatting on-chain values in the UI.
 * bigint → human-readable decimal string.
 */

export function formatBalance(amount: bigint, decimals: number): string {
  if (decimals === 0) return amount.toString();
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
}
