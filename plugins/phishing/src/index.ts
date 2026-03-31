import { PhishingDetector } from "./detector";
import { manifest } from "./manifest";

export const plugin = new PhishingDetector();

export { PhishingDetector } from "./detector";
export { manifest };
export { BLOCKED_ADDRESSES, SCAM_PATTERNS } from "./threatList";
