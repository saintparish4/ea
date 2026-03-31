"use client";

import { create } from "zustand";
import type { PluginManifest } from "@ea/types";
import { getRuntime, initRuntime } from "../runtime";

/** UI row — manifest + enabled flag (no plugin instance). */
export interface PluginListItem {
  manifest: PluginManifest;
  enabled: boolean;
}

interface PluginState {
  plugins: PluginListItem[];
  refresh: () => void;
  toggle: (pluginId: string) => void;
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],

  refresh() {
    void (async () => {
      await initRuntime();
      const { registry } = getRuntime();
      const all = registry.list();
      set({
        plugins: all.map((r) => ({ manifest: r.manifest, enabled: r.enabled })),
      });
    })();
  },

  toggle(pluginId: string) {
    void (async () => {
      await initRuntime();
      const { registry } = getRuntime();
      const record = registry.get(pluginId);
      if (record === undefined) return;

      if (record.enabled) {
        registry.disable(pluginId);
      } else {
        registry.enable(pluginId);
      }

      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.manifest.id === pluginId ? { ...p, enabled: !p.enabled } : p,
        ),
      }));
    })();
  },
}));
