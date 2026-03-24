import { ok, err } from "@ea/types";
import type {
  Result,
  EaError,
  SecurityBlockError,
  UnsignedTx,
  SimulationResult,
  SignablePayload,
  Signature,
  PreSignContext,
  PostSignContext,
  SecurityCheckResult,
  AuditEntry,
  TxParams,
  ChainPlugin,
  SecurityPlugin,
} from "@ea/types";
import { withTimeout } from "@ea/common";
import type { Logger } from "@ea/common";
import { noopLogger } from "@ea/common";
import type { PluginRecord } from "./loader.js";
import type { KeyProvider } from "./key-provider.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineConfig {
  /** Timeout for the simulateTransaction stage. Default: 3000 ms */
  simulationTimeoutMs?: number;
  /** Timeout per security plugin onPreSign call. Default: 2000 ms */
  securityCheckTimeoutMs?: number;
  logger?: Logger;
  /** Called synchronously after each stage completes. Use to persist audit entries. */
  onAudit?: (entry: AuditEntry) => void;
}

export interface PipelineResult {
  tx: UnsignedTx;
  simulation: SimulationResult | undefined;
  signature: Signature;
  /** Aggregated warnings from simulation + security plugins. */
  warnings: string[];
  auditEntries: AuditEntry[];
}

type ChainRecord = PluginRecord & { instance: ChainPlugin };
type SecurityRecord = PluginRecord & { instance: SecurityPlugin };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function newAuditEntry(
  pluginId: string,
  operation: AuditEntry["operation"],
  stage: AuditEntry["stage"],
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  durationMs: number,
  result: "ok" | "error",
  sessionId: string,
  errorCode?: string,
): AuditEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    pluginId,
    operation,
    stage,
    input,
    output,
    durationMs,
    result,
    ...(errorCode !== undefined ? { errorCode } : {}),
    sessionId,
  };
}

// ---------------------------------------------------------------------------
// SigningPipeline
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full signing flow:
 *
 *   buildTx → simulateTx → securityChecks (parallel) → prepareSigning
 *     → sign (via KeyProvider, outside sandbox) → postSign hooks
 *
 * Every stage is wrapped by the audit interceptor.
 * Security checks run via Promise.allSettled so a crash in one
 * plugin does not prevent the others from running.
 */
export class SigningPipeline {
  private readonly simulationTimeoutMs: number;
  private readonly securityCheckTimeoutMs: number;
  private readonly logger: Logger;
  private readonly onAudit: (entry: AuditEntry) => void;

  constructor(config: PipelineConfig = {}) {
    this.simulationTimeoutMs = config.simulationTimeoutMs ?? 3_000;
    this.securityCheckTimeoutMs = config.securityCheckTimeoutMs ?? 2_000;
    this.logger = config.logger ?? noopLogger;
    this.onAudit = config.onAudit ?? ((): void => undefined);
  }

  async execute(
    params: TxParams,
    chainPlugin: ChainRecord,
    securityPlugins: SecurityRecord[],
    keyProvider: KeyProvider,
    sessionId: string,
  ): Promise<Result<PipelineResult, EaError>> {
    const auditEntries: AuditEntry[] = [];
    const warnings: string[] = [];

    const audit = (entry: AuditEntry): void => {
      auditEntries.push(entry);
      this.onAudit(entry);
    };

    // ── Stage 1: Build ──────────────────────────────────────────────────────
    const buildResult = await this._buildTx(params, chainPlugin, sessionId, audit);
    if (!buildResult.ok) return buildResult;
    const tx = buildResult.value;

    // ── Stage 2: Simulate ───────────────────────────────────────────────────
    let simulation: SimulationResult | undefined;
    if (typeof chainPlugin.instance.simulateTransaction === "function") {
      const simResult = await this._simulateTx(tx, chainPlugin, sessionId, audit);
      if (!simResult.ok) return simResult;
      simulation = simResult.value;
      warnings.push(...simulation.warnings);
    } else {
      this.logger.info("Simulation skipped — plugin does not implement simulateTransaction", {
        pluginId: chainPlugin.manifest.id,
        stage: "simulate",
      });
    }

    // ── Stage 3: Security checks (parallel) ────────────────────────────────
    const enabledSecPlugins = securityPlugins.filter((p) => p.enabled);
    if (enabledSecPlugins.length > 0) {
      const context: PreSignContext = {
        pluginId: chainPlugin.manifest.id,
        tx,
        ...(simulation !== undefined ? { simulation } : {}),
        fromAddress: params.from,
        toAddress: params.to,
        amount: params.amount,
        chain: params.chain,
      };
      const secResult = await this._runSecurityChecks(
        context,
        enabledSecPlugins,
        sessionId,
        audit,
        warnings,
      );
      if (!secResult.ok) return secResult;
    }

    // ── Stage 4: Prepare signable payload ──────────────────────────────────
    let signable: SignablePayload;
    if (typeof chainPlugin.instance.prepareForSigning === "function") {
      const prepResult = await this._prepareSigning(tx, chainPlugin, sessionId, audit);
      if (!prepResult.ok) return prepResult;
      signable = prepResult.value;
    } else {
      // Fallback: pass raw tx bytes directly
      signable = { chain: tx.chain, data: tx.raw, metadata: tx.metadata };
    }

    // ── Stage 5: Sign (outside sandbox — Decision #2) ──────────────────────
    const signStart = Date.now();
    const signResult = await keyProvider.sign(params.chain, signable);
    const signDuration = Date.now() - signStart;

    audit(
      newAuditEntry(
        "system",
        "sign",
        "sign",
        { chain: params.chain },
        signResult.ok ? { success: true } : { errorCode: signResult.error.code },
        signDuration,
        signResult.ok ? "ok" : "error",
        sessionId,
        signResult.ok ? undefined : signResult.error.code,
      ),
    );

    if (!signResult.ok) return signResult;
    const signature = signResult.value;

    // ── Stage 6: Post-sign hooks ────────────────────────────────────────────
    if (enabledSecPlugins.length > 0) {
      const postContext: PostSignContext = {
        pluginId: chainPlugin.manifest.id,
        tx,
        signature,
        chain: params.chain,
      };
      await this._runPostSign(postContext, enabledSecPlugins, sessionId, audit);
    }

    return ok({ tx, simulation, signature, warnings, auditEntries });
  }

  // ── Private stage implementations ─────────────────────────────────────────

  private async _buildTx(
    params: TxParams,
    plugin: ChainRecord,
    sessionId: string,
    audit: (e: AuditEntry) => void,
  ): Promise<Result<UnsignedTx, EaError>> {
    if (typeof plugin.instance.buildTransaction !== "function") {
      return err({
        code: "PLUGIN_ERROR",
        message: `Chain plugin "${plugin.manifest.id}" does not implement buildTransaction`,
        pluginId: plugin.manifest.id,
      });
    }

    const start = Date.now();
    const result = await plugin.instance.buildTransaction(params);
    const duration = Date.now() - start;

    audit(
      newAuditEntry(
        plugin.manifest.id,
        "buildTransaction",
        "build",
        { from: params.from, to: params.to, chain: params.chain },
        result.ok ? {} : { errorCode: result.error.code },
        duration,
        result.ok ? "ok" : "error",
        sessionId,
        result.ok ? undefined : result.error.code,
      ),
    );

    return result;
  }

  private async _simulateTx(
    tx: UnsignedTx,
    plugin: ChainRecord,
    sessionId: string,
    audit: (e: AuditEntry) => void,
  ): Promise<Result<SimulationResult, EaError>> {
    const start = Date.now();
    const timedResult = await withTimeout(
      plugin.instance.simulateTransaction!(tx),
      this.simulationTimeoutMs,
      "simulate",
    );
    const duration = Date.now() - start;

    if (!timedResult.ok) {
      audit(
        newAuditEntry(
          plugin.manifest.id,
          "simulateTransaction",
          "simulate",
          {},
          { errorCode: "TIMEOUT_ERROR" },
          duration,
          "error",
          sessionId,
          "TIMEOUT_ERROR",
        ),
      );
      return timedResult;
    }

    const simResult = timedResult.value;
    audit(
      newAuditEntry(
        plugin.manifest.id,
        "simulateTransaction",
        "simulate",
        {},
        simResult.ok
          ? { fee: simResult.value.fee.toString(), feeSymbol: simResult.value.feeSymbol }
          : { errorCode: simResult.error.code },
        duration,
        simResult.ok ? "ok" : "error",
        sessionId,
        simResult.ok ? undefined : simResult.error.code,
      ),
    );

    return simResult;
  }

  private async _runSecurityChecks(
    context: PreSignContext,
    plugins: SecurityRecord[],
    sessionId: string,
    audit: (e: AuditEntry) => void,
    warnings: string[],
  ): Promise<Result<void, EaError>> {
    type CheckOutcome = { pluginId: string; checkResult: SecurityCheckResult } | null;

    const settled = await Promise.allSettled<CheckOutcome>(
      plugins.map(async (plugin): Promise<CheckOutcome> => {
        const start = Date.now();
        const timedResult = await withTimeout(
          plugin.instance.onPreSign(context),
          this.securityCheckTimeoutMs,
          `security-check:${plugin.manifest.id}`,
        );
        const duration = Date.now() - start;

        if (!timedResult.ok) {
          // Timeout — log but don't let this block other checks
          audit(
            newAuditEntry(
              plugin.manifest.id,
              "onPreSign",
              "security-check",
              {},
              { errorCode: "TIMEOUT_ERROR" },
              duration,
              "error",
              sessionId,
              "TIMEOUT_ERROR",
            ),
          );
          this.logger.warn(`Security plugin "${plugin.manifest.id}" timed out`, {
            pluginId: plugin.manifest.id,
            stage: "security-check",
          });
          return null;
        }

        const pluginResult = timedResult.value;
        audit(
          newAuditEntry(
            plugin.manifest.id,
            "onPreSign",
            "security-check",
            {},
            pluginResult.ok
              ? { action: pluginResult.value.action }
              : { errorCode: pluginResult.error.code },
            duration,
            pluginResult.ok ? "ok" : "error",
            sessionId,
            pluginResult.ok ? undefined : pluginResult.error.code,
          ),
        );

        if (!pluginResult.ok) {
          // Plugin crashed — log and continue, do not block pipeline
          this.logger.error(`Security plugin "${plugin.manifest.id}" returned error`, {
            pluginId: plugin.manifest.id,
            stage: "security-check",
          });
          return null;
        }

        const checkResult = pluginResult.value;
        if (checkResult.action === "warn") {
          warnings.push(checkResult.message);
        }

        return { pluginId: plugin.manifest.id, checkResult };
      }),
    );

    // A single "block" from any plugin halts the pipeline
    for (const outcome of settled) {
      if (outcome.status === "fulfilled" && outcome.value?.checkResult.action === "block") {
        const { pluginId, checkResult } = outcome.value;
        return err({
          code: "SECURITY_BLOCK_ERROR",
          message: checkResult.message,
          pluginId,
          reason: checkResult.details ?? checkResult.message,
        } satisfies SecurityBlockError);
      }
    }

    return ok(undefined);
  }

  private async _prepareSigning(
    tx: UnsignedTx,
    plugin: ChainRecord,
    sessionId: string,
    audit: (e: AuditEntry) => void,
  ): Promise<Result<SignablePayload, EaError>> {
    const start = Date.now();
    const result = await plugin.instance.prepareForSigning!(tx);
    const duration = Date.now() - start;

    audit(
      newAuditEntry(
        plugin.manifest.id,
        "prepareForSigning",
        "sign",
        {},
        result.ok ? {} : { errorCode: result.error.code },
        duration,
        result.ok ? "ok" : "error",
        sessionId,
        result.ok ? undefined : result.error.code,
      ),
    );

    return result;
  }

  private async _runPostSign(
    context: PostSignContext,
    plugins: SecurityRecord[],
    sessionId: string,
    audit: (e: AuditEntry) => void,
  ): Promise<void> {
    await Promise.allSettled(
      plugins
        .filter((p) => typeof p.instance.onPostSign === "function")
        .map(async (plugin) => {
          const start = Date.now();
          // TODO(observability): on thrown hook, use `catch (cause)` and attach the error to
          // `logger.error` context (or `cause:`) so failures are diagnosable in production.
          try {
            const result = await plugin.instance.onPostSign!(context);
            const duration = Date.now() - start;
            audit(
              newAuditEntry(
                plugin.manifest.id,
                "onPostSign",
                "post-sign",
                {},
                result?.ok ? {} : { errorCode: result?.error?.code },
                duration,
                result?.ok ? "ok" : "error",
                sessionId,
                result?.ok ? undefined : result?.error?.code,
              ),
            );
          } catch {
            this.logger.error(`Post-sign hook for "${plugin.manifest.id}" threw`, {
              pluginId: plugin.manifest.id,
              stage: "post-sign",
            });
          }
        }),
    );
  }
}
