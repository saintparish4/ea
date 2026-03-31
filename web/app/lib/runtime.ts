/**
 * Client-side singleton that boots the Ea runtime.
 *
 * Imported by Providers on app mount. All stores call getRuntime() to obtain
 * the initialised registry + pipeline without triggering a second init.
 *
 * NOTE: This module must only run in the browser. The `ses` lockdown and
 * InMemoryKeyProvider use Web Crypto APIs not available in the Next.js server
 * context. The "use client" directive on Providers ensures this.
 */

import { PluginRegistry, SigningPipeline, InMemoryKeyProvider } from "@ea/runtime";
import type { AuditEntry } from "@ea/types";
import { createConsoleLogger } from "@ea/common";
import type { Logger } from "@ea/common";
import { useAuditStore } from "./store/audit-store";

/** Dev-only test mnemonic — matches bundled chain plugins’ `plugin` export. */
const DEV_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EaRuntime {
  registry: PluginRegistry;
  pipeline: SigningPipeline;
  keyProvider: InMemoryKeyProvider;
}

// ---------------------------------------------------------------------------
// Singleton (globalThis survives Next.js Fast Refresh; module scope does not)
// ---------------------------------------------------------------------------

const g = globalThis as typeof globalThis & {
  __eaRuntime?: EaRuntime | null;
  __eaInitPromise?: Promise<EaRuntime> | null;
};

export async function initRuntime(): Promise<EaRuntime> {
  if (g.__eaRuntime != null) return g.__eaRuntime;
  if (g.__eaInitPromise) return g.__eaInitPromise;

  g.__eaInitPromise = _boot().then((r) => {
    g.__eaRuntime = r;
    return r;
  });
  return g.__eaInitPromise;
}

export function getRuntime(): EaRuntime {
  if (g.__eaRuntime == null) {
    throw new Error("[Ea] Runtime has not been initialised yet. Call initRuntime() first.");
  }
  return g.__eaRuntime;
}

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

async function _boot(): Promise<EaRuntime> {
  const logger = createConsoleLogger({ operation: "ea:runtime" });

  // Key provider — in production this would derive the seed from a hardware
  // wallet or user passphrase. Here we use a fixed dev mnemonic + passphrase.
  const keyProvider = new InMemoryKeyProvider();
  await keyProvider.initialize(DEV_MNEMONIC, "dev");

  const registry = new PluginRegistry(logger);

  // Audit sink: push every entry into Zustand so the UI reflects live data.
  const onAudit = (entry: AuditEntry): void => {
    useAuditStore.getState().addEntry(entry);
  };

  const pipeline = new SigningPipeline({
    logger,
    onAudit,
    simulationTimeoutMs: 5_000,
    securityCheckTimeoutMs: 3_000,
  });

  // Eagerly load bundled plugins. In a real wallet these would be fetched from
  // a registry or loaded from the filesystem via the SES sandbox.
  await _loadBundledPlugins(registry, logger);

  logger.info("Ea runtime ready", {});
  return { registry, pipeline, keyProvider };
}

async function _loadBundledPlugins(registry: PluginRegistry, logger: Logger): Promise<void> {
  // Relative to `web/app/lib` → repo `plugins/*` (avoids TS/IDE failing on
  // `workspace:*` resolution; pnpm still lists these in web/package.json).
  const pluginModules = [
    () => import("../../../plugins/bitcoin/src/index"),
    () => import("../../../plugins/solana/src/index"),
    () => import("../../../plugins/phishing/src/index"),
  ];

  for (const load of pluginModules) {
    try {
      const mod = await load();
      const result = registry.register(mod.manifest, mod.plugin as object);
      if (!result.ok) {
        logger.warn("Failed to register plugin", { error: result.error.message });
      }
    } catch (err) {
      logger.warn("Failed to import plugin module", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
