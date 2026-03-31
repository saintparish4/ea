"use client";

import { useEffect } from "react";
import { usePluginStore } from "@/app/lib/store/plugin-store";
import { PluginCard } from "@/app/components/pluginCard";

export function PluginsView() {
  const { plugins, refresh, toggle } = usePluginStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">Plugins</h1>
      {plugins.length === 0 ? (
        <p className="text-sm text-gray-500">No plugins loaded.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((p) => (
            <PluginCard
              key={p.manifest.id}
              manifest={p.manifest}
              enabled={p.enabled}
              onToggle={() => {
                toggle(p.manifest.id);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
