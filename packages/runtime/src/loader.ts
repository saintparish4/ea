import { PluginManifestSchema, ok, err } from "@ea/types";
import type { PluginManifest, Result, ValidationError, PluginError } from "@ea/types";
import { validate } from "@ea/common";
import type { Logger } from "@ea/common";
import { noopLogger } from "@ea/common";

export interface PluginRecord {
  manifest: PluginManifest;
  instance: unknown;
  enabled: boolean;
  loadedAt: number;
}

/**
 * Validates a raw unknown value against the PluginManifestSchema
 * Use this at plugin install/load boundaries before constrcuting a PluginRecord
 */
export function validateManifest(raw: unknown): Result<PluginManifest, ValidationError> {
  return validate(PluginManifestSchema, raw);
}

/**
 * Central in-memory registry of loaded plugins
 *
 * Loading priority:
 * - "chain" and "security" plugins: eager -- caller should register these during
 *    runtime initialization before any signing requests arrive
 * - "utility" plugins: lazy -- caller registers on first use
 *
 * The registry itself is priority-agnostic; priority enforcement lives in the
 * bootstrapping code that calls register()
 */
export class PluginRegistry {
  private readonly records = new Map<string, PluginRecord>();
  private readonly logger: Logger;

  constructor(logger: Logger = noopLogger) {
    this.logger = logger;
  }

  /**
   * Register a validated manifest + plugin instance
   * Returns PluginError if the id is already registered
   */
  register(manifest: PluginManifest, instance: unknown): Result<void, PluginError> {
    if (this.records.has(manifest.id)) {
      return err({
        code: "PLUGIN_ERROR",
        message: `Plugin ${manifest.id} already registered`,
        pluginId: manifest.id,
      });
    }

    this.records.set(manifest.id, {
      manifest,
      instance,
      enabled: true,
      loadedAt: Date.now(),
    });

    this.logger.info("Plugin registered", {
      pluginId: manifest.id,
      operation: "loadPlugin",
      stage: "loader",
    });

    return ok(undefined);
  }

  /**
   * Remove a plugin from the registry entirely
   * Returns PluginError if the id is not registered
   */
  unregister(pluginId: string): Result<void, PluginError> {
    if (!this.records.has(pluginId)) {
      return err({
        code: "PLUGIN_ERROR",
        message: `Plugin ${pluginId} not registered`,
        pluginId,
      });
    }

    this.records.delete(pluginId);

    this.logger.info("Plugin unregistered", {
      pluginId,
      operation: "unloadPlugin",
      stage: "loader",
    });

    return ok(undefined);
  }

  /** Returns the PluginRecord or undefined if not registered */
  get(pluginId: string): PluginRecord | undefined {
    return this.records.get(pluginId);
  }

  /** Enabled a previously disabled plugin. Returns false if not found */
  enable(pluginId: string): boolean {
    const record = this.records.get(pluginId);
    if (!record) return false;
    record.enabled = true;
    this.logger.info("Plugin enabled", { pluginId });
    return true;
  }

  /** Disable a plugin without removing it. Returns false if not found */
  disable(pluginId: string): boolean {
    const record = this.records.get(pluginId);
    if (!record) return false;
    record.enabled = false;
    this.logger.info("Plugin disabled", { pluginId });
    return true;
  }

  isEnabled(pluginId: string): boolean {
    return this.records.get(pluginId)?.enabled ?? false;
  }

  /** All registered plugins (enabled and disabled) */
  list(): PluginRecord[] {
    return Array.from(this.records.values());
  }

  /** Only plugins that are currently enabled */
  listEnabled(): PluginRecord[] {
    return this.list().filter((r) => r.enabled);
  }

  /** Enabled plugins filtered by manifest type */
  listEnabledByType(type: PluginManifest["type"]): PluginRecord[] {
    return this.listEnabled().filter((r) => r.manifest.type === type);
  }
}
