import { PluginManifestSchema } from "@ea/types";

export const manifest = PluginManifestSchema.parse({
  id: "ea.plugin.bitcoin",
  version: "0.1.0",
  name: "Bitcoin",
  type: "chain",
  permissions: ["network:esplora"],
  endowments: ["fetch", "crypto"],
  supportedChains: ["bitcoin", "bitcoin-testnet"],
  capabilities: ["AccountProvider", "TransactionBuilder", "TransactionSimulator"],
});
