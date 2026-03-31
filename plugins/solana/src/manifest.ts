import { PluginManifestSchema } from "@ea/types";

export const manifest = PluginManifestSchema.parse({
  id: "ea-plugin-solana",
  version: "0.1.0",
  name: "Solana",
  type: "chain",
  permissions: ["network:fetch"],
  endowments: ["fetch", "crypto"],
  supportedChains: ["solana", "solana-devnet"],
  capabilities: ["AccountProvider", "TransactionBuilder", "TransactionSimulator"],
  entryPoint: "./src/index",
});
