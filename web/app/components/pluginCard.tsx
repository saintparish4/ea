"use client";

import type { PluginManifest } from "@ea/types";

interface Props {
  manifest: PluginManifest;
  enabled: boolean;
  onToggle: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  chain: "bg-brand-100 text-brand-700",
  security: "bg-purple-100 text-purple-700",
  utility: "bg-gray-100 text-gray-700",
};

export function PluginCard({ manifest, enabled, onToggle }: Props) {
  return (
    <li className="rounded-[var(--radius-card)] border border-gray-200 bg-white p-5 shadow-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{manifest.name}</p>
          <p className="text-xs text-gray-400">
            {manifest.id}@{manifest.version}
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            TYPE_COLORS[manifest.type] ?? "bg-gray-100 text-gray-700",
          ].join(" ")}
        >
          {manifest.type}
        </span>
      </div>

      {manifest.capabilities.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {manifest.capabilities.map((cap) => (
            <span
              key={cap}
              className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500"
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      {manifest.permissions.length > 0 && (
        <p className="mb-3 text-xs text-gray-400">Permissions: {manifest.permissions.join(", ")}</p>
      )}

      {/* Enable/disable toggle */}
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
          enabled ? "bg-brand-600" : "bg-gray-300",
        ].join(" ")}
      >
        <span className="sr-only">{enabled ? "Disable plugin" : "Enable plugin"}</span>
        <span
          className={[
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </li>
  );
}
