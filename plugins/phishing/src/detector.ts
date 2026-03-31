import type {
  SecurityPlugin,
  PreSignContext,
  SecurityCheckResult,
  Result,
  PluginError,
} from "@ea/types";
import { BLOCKED_ADDRESSES, SCAM_PATTERNS } from "./threatList";

export class PhishingDetector implements SecurityPlugin {
  async onPreSign(context: PreSignContext): Promise<Result<SecurityCheckResult, PluginError>> {
    const to = context.toAddress;

    if (BLOCKED_ADDRESSES.has(to)) {
      return {
        ok: true,
        value: {
          action: "block",
          message: `Destination address ${to} is on the phishing threat list.`,
        },
      };
    }

    for (const pattern of SCAM_PATTERNS) {
      if (pattern.test(to)) {
        return {
          ok: true,
          value: {
            action: "warn",
            message: `Destination address ${to} matches a known scam address pattern.`,
          },
        };
      }
    }

    const ownedAddresses = new Set<string>([
      context.fromAddress,
      ...(context.senderAccounts?.map((a) => a.address) ?? []),
    ]);
    if (ownedAddresses.has(to)) {
      return {
        ok: true,
        value: {
          action: "warn",
          message:
            "Destination is one of your addresses (sender or listed account). Confirm this is intentional.",
        },
      };
    }

    return {
      ok: true,
      value: { action: "allow", message: "No threats detected." },
    };
  }
}
