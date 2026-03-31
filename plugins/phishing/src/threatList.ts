// Static threat list bundled with the plugin — update via plugin version bumps
export const BLOCKED_ADDRESSES = new Set<string>([
  // Example known scam addresses (illustrative only)
  "1ScamAddressExampleXXXXXXXXXXXXXXXX",
  "So11111111111111111111111111111111111111112", // wrapped SOL — never a send target
]);

export const SCAM_PATTERNS = [
  /^1{10,}/, // many leading 1s — vanity scam pattern
  /^0{6,}/, // many leading zeros
];
