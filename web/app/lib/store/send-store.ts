"use client";

import { create } from "zustand";
import type { ChainPlugin, EaError, SecurityPlugin, Signature, SimulationResult } from "@ea/types";
import type { PluginRecord } from "@ea/runtime";
import { getRuntime, initRuntime } from "../runtime";

type ChainRecord = PluginRecord & { instance: ChainPlugin };
type SecurityRecord = PluginRecord & { instance: SecurityPlugin };

function findChainRecord(
  registry: ReturnType<typeof getRuntime>["registry"],
  chain: string,
): ChainRecord | undefined {
  const found = registry
    .listEnabledByType("chain")
    .find((r) => r.manifest.supportedChains?.includes(chain));
  return found !== undefined ? (found as ChainRecord) : undefined;
}

export type SendStage =
  | "form"
  | "simulating"
  | "confirmation"
  | "signing"
  | "done"
  | "error"
  | "blocked";

interface SendState {
  chain: string;
  from: string;
  to: string;
  amount: string;
  stage: SendStage;
  simulation: SimulationResult | null;
  securityWarnings: string[];
  blockReason: string | null;
  signature: Signature | null;
  error: EaError | null;
  sessionId: string;

  setField: (field: "chain" | "from" | "to" | "amount", value: string) => void;
  runSimulationAndCheck: () => Promise<void>;
  confirmAndSign: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  chain: "bitcoin",
  from: "",
  to: "",
  amount: "",
  stage: "form" as SendStage,
  simulation: null,
  securityWarnings: [],
  blockReason: null,
  signature: null,
  error: null,
  sessionId: crypto.randomUUID(),
};

export const useSendStore = create<SendState>((set, get) => ({
  ...initialState,

  setField(field, value) {
    set({ [field]: value });
  },

  async runSimulationAndCheck() {
    const { chain, from, to, amount, sessionId } = get();
    set({ stage: "simulating", error: null, simulation: null, securityWarnings: [] });

    await initRuntime();
    const { registry, pipeline, keyProvider } = getRuntime();
    const chainRecord = findChainRecord(registry, chain);
    if (chainRecord === undefined) {
      set({
        stage: "error",
        error: {
          code: "PLUGIN_ERROR",
          message: `No plugin for chain: ${chain}`,
          pluginId: "system",
        },
      });
      return;
    }

    const params = {
      from,
      to,
      amount: BigInt(amount),
      chain,
    };

    const securityPlugins = registry.listEnabledByType("security") as SecurityRecord[];
    const result = await pipeline.execute(
      params,
      chainRecord,
      securityPlugins,
      keyProvider,
      sessionId,
    );

    if (!result.ok) {
      if (result.error.code === "SECURITY_BLOCK_ERROR") {
        set({ stage: "blocked", blockReason: result.error.reason });
      } else {
        set({ stage: "error", error: result.error });
      }
      return;
    }

    set({
      stage: "confirmation",
      simulation: result.value.simulation ?? null,
      securityWarnings: result.value.warnings,
      signature: result.value.signature,
    });
  },

  async confirmAndSign() {
    const { signature } = get();
    // Signature was already produced during runSimulationAndCheck (pipeline runs
    // full build→simulate→sign). Here we just advance the stage to "done".
    if (signature === null) {
      set({
        stage: "error",
        error: { code: "VALIDATION_ERROR", message: "No signature available" },
      });
      return;
    }
    set({ stage: "done" });
  },

  reset() {
    set({ ...initialState, sessionId: crypto.randomUUID() });
  },
}));
