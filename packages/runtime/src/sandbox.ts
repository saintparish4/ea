import { ok, err } from "@ea/types";
import type { Result, SandboxError } from "@ea/types";

function sandboxError(pluginId: string, message: string, caught: unknown): SandboxError {
  return {
    code: "SANDBOX_ERROR",
    message,
    pluginId,
    ...(caught instanceof Error ? { cause: caught } : {}),
  };
}

// ------------------------------------------------------------
// Public interfaces
// ------------------------------------------------------------

/**
 * A handle to a live plugin compartment. Callers use `call` to invoke an
 * exported plugin method inside the sandbox
 */
export interface PluginCompartment {
  readonly pluginId: string;
  call<T>(method: string, args: unknown[]): Promise<Result<T, SandboxError>>;
}

/**
 * Abstraction over the sandbox engine so we can swap SES for a different
 * implementation (vm2, worker threads, WASM, etc.)  without touching the runtime
 */
export interface SandboxProvider {
  createCompartment(
    pluginId: string,
    code: string,
    endowments: Record<string, unknown>,
  ): Promise<Result<PluginCompartment, SandboxError>>;
  destroyCompartment(pluginId: string): Promise<void>;
  hasCompartment(pluginId: string): boolean;
}

// ------------------------------------------------------------
// SES implementation
// ------------------------------------------------------------

/**
 * Default SandboxProvider backed by @endo/ses (the `ses` npm package).
 *
 * Usage:
 *   import "ses";             // must be imported ONCE at app entry point
 *   lockdown({ ... });        // hardens the JS environment
 *
 * Each plugin gets its own persistent Compartment.  Compartments
 * are created on plugin load and reused across calls — never recreated per call.
 *
 * Allowed endowments surface:
 *   - fetch  (scoped via RpcProvider — plugins never get raw fetch)
 *   - console (filtered, output goes to audit log)
 *   - crypto.getRandomValues
 *   - requestSigning (routes through the pipeline, never KeyProvider directly)
 *   - rpcProvider
 */
export class SesSandboxProvieder implements SandboxProvider {
  private readonly compartments = new Map<
    string,
    { compartment: unknown; exports: Record<string, unknown> }
  >();

  async createCompartment(
    pluginId: string,
    code: string,
    endowments: Record<string, unknown>,
  ): Promise<Result<PluginCompartment, SandboxError>> {
    if (this.compartments.has(pluginId)) {
      return err({
        code: "SANDBOX_ERROR",
        message: `Compartment for plugin ${pluginId} already exists`,
        pluginId,
      });
    }

    // Compartment is inject into globalThis by `import "ses" + lockdown()
    const CompartmentCtor = (globalThis as Record<string, unknown>)["Compartment"];
    if (typeof CompartmentCtor !== "function") {
      return err({
        code: "SANDBOX_ERROR",
        message:
          'SES Compartment not available -- import "ses" and lockdown() before creating compartments',
        pluginId,
      });
    }

    try {
      const compartment = new (CompartmentCtor as new (e: Record<string, unknown>) => {
        evaluate(src: string): unknown;
      })(endowments);

      const rawExports = compartment.evaluate(code);
      const exports =
        rawExports !== null && typeof rawExports === "object"
          ? (rawExports as Record<string, unknown>)
          : {};

      this.compartments.set(pluginId, { compartment, exports });

      const compartments = this.compartments;
      const pluginCompartment: PluginCompartment = {
        pluginId,
        async call<T>(method: string, args: unknown[]): Promise<Result<T, SandboxError>> {
          const entry = compartments.get(pluginId);
          if (!entry) {
            return err({
              code: "SANDBOX_ERROR",
              message: `Compartment for plugin ${pluginId} has been destroyed`,
              pluginId,
            });
          }

          const fn = entry.exports[method];
          if (typeof fn !== "function") {
            return err({
              code: "SANDBOX_ERROR",
              message: `Plugin "${pluginId}" does not export "${method}"`,
              pluginId,
            });
          }

          try {
            const result = await (fn as (...a: unknown[]) => unknown)(...args);
            return ok(result as T);
          } catch (cause) {
            return err(
              sandboxError(pluginId, cause instanceof Error ? cause.message : String(cause), cause),
            );
          }
        },
      };

      return ok(pluginCompartment);
    } catch (cause) {
      return err(
        sandboxError(pluginId, cause instanceof Error ? cause.message : String(cause), cause),
      );
    }
  }

  async destroyCompartment(pluginId: string): Promise<void> {
    this.compartments.delete(pluginId);
  }

  hasCompartment(pluginId: string): boolean {
    return this.compartments.has(pluginId);
  }
}

/**
 * Build the standard endowment set for a plugin compartment.
 * Only items in the plugin's manifest.endowments[] are included.
 *
 * @param declared  - endowments array from the validated manifest
 * @param scopedFetch  - a fetch-like function routed through RpcProvider
 * @param scopedConsole - a console object whose output goes to the audit log
 * @param requestSigning - pipeline entry point (never raw KeyProvider)
 * @param rpcProvider - the shared RpcProvider instance
 */
export function buildEndowments(
  declared: string[],
  options: {
    scopedFetch?: (url: string, init?: RequestInit) => Promise<Response>;
    scopedConsole?: Partial<Console>;
    requestSigning?: (payload: unknown) => Promise<unknown>;
    rpcProvider?: unknown;
  } = {},
): Record<string, unknown> {
  const endowments: Record<string, unknown> = {};
  const set = new Set(declared);

  if (set.has("fetch") && options.scopedFetch) {
    endowments["fetch"] = options.scopedFetch;
  }
  if (set.has("console") && options.scopedConsole) {
    endowments["console"] = options.scopedConsole;
  }
  if (set.has("crypto")) {
    endowments["crypto"] = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  }
  if (set.has("requestSigning") && options.requestSigning) {
    endowments["requestSigning"] = options.requestSigning;
  }
  if (set.has("rpcProvider") && options.rpcProvider) {
    endowments["rpcProvider"] = options.rpcProvider;
  }

  return endowments;
}
