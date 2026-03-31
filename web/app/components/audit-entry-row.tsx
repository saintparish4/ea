"use client";

import type { AuditEntry } from "@ea/types";

interface Props {
  entry: AuditEntry;
}

export function AuditEntryRow({ entry }: Props) {
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-xs text-gray-500">{time}</td>
      <td className="px-4 py-3 font-mono text-xs text-gray-700">{entry.pluginId}</td>
      <td className="px-4 py-3 text-xs text-gray-700">{entry.operation}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{entry.stage}</td>
      <td className="px-4 py-3 text-xs tabular-nums text-gray-500">{entry.durationMs}ms</td>
      <td className="px-4 py-3">
        <span
          className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            entry.result === "ok" ? "bg-green-100 text-green-700" : "bg-danger-50 text-danger-500",
          ].join(" ")}
        >
          {entry.result === "ok" ? "ok" : `error:${entry.errorCode ?? "?"}`}
        </span>
      </td>
    </tr>
  );
}
