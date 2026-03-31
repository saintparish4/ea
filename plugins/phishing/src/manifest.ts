import { PluginManifestSchema } from "@ea/types";

export const manifest = PluginManifestSchema.parse({
  id: "ea.plugin.phishing",
  version: "0.1.0",
  name: "Phishing Detection",
  type: "security",
  permissions: [],
  endowments: [],
  supportedChains: [],
  capabilities: ["SecurityPlugin"],
});
