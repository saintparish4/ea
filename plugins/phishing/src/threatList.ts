// Static threat list bundled with the plugin — update via plugin version bumps
export const BLOCKED_ADDRESSES = new Set<string>([
  // Example known scam addresses (illustrative only) — must be valid chain addresses
  // so Bitcoin build/simulation can run before the security plugin blocks signing.
  "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "So11111111111111111111111111111111111111112", // wrapped SOL — never a send target
]);

export const SCAM_PATTERNS = [
  /^1{10,}/, // many leading 1s — vanity scam pattern
  /^0{6,}/, // many leading zeros
];
