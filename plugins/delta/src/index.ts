/**
 * Delta "Hello-World" plugin
 *
 * Purpose: validate the full plugin lifecycle end-to-end
 *  manifest validation -> sandbox loading -> endowment access -> method execution
 *  -> audit logging
 *
 * This plugin intentionally has no chain-specific logic so it can run in any
 * test environment without external dependencies
 */
import type { PluginManifest } from "@ea/types";

export const manifest: PluginManifest = {
  id: "hello-world",
  version: "0.1.0",
  name: "Hello World",
  description: "Minimal utility plugin that validates the full Ea runtime lifecycle.",
  type: "utility",
  permissions: ["console:log"],
  endowments: ["console"],
  capabilities: [],
  entryPoint: "index.js",
};

/** Returns a greeting string */
export function greet(name: string): string {
  return `Hello, ${name}! Ea plugin runtime is working.`;
}

/** Returns a JSON-serialisable info object for health-check purposes */
export function getInfo(): Record<string, unknown> {
  return {
    pluginId: manifest.id,
    version: manifest.version,
    runtimeReady: true,
    timestamp: Date.now(),
  };
}
