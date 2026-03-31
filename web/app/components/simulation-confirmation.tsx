"use client";

import { useSendStore } from "@/app/lib/store/send-store";
import { formatBalance } from "@/app/lib/format";

export function SimulationConfirmation() {
  const { stage, simulation, securityWarnings, blockReason, signature, reset, confirmAndSign } =
    useSendStore();

  const isBlocked = stage === "blocked";
  const isDone = stage === "done";

  if (isDone) {
    return (
      <div className="max-w-lg rounded-[var(--radius-card)] border border-green-200 bg-green-50 p-6">
        <p className="mb-1 text-lg font-semibold text-green-800">Transaction sent</p>
        <p className="mb-4 font-mono text-xs text-green-700 break-all">
          {signature !== null ? Buffer.from(signature.data).toString("hex") : "—"}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          New transaction
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      {/* Security block banner */}
      {isBlocked && blockReason !== null && (
        <div className="rounded-[var(--radius-card)] border border-danger-500 bg-danger-50 p-4">
          <p className="font-semibold text-danger-500">Transaction blocked</p>
          <p className="mt-1 text-sm text-danger-500">{blockReason}</p>
        </div>
      )}

      {/* Warnings */}
      {securityWarnings.length > 0 && (
        <ul className="space-y-2">
          {securityWarnings.map((w, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-lg border border-warn-500 bg-warn-50 p-3 text-sm text-warn-500"
            >
              <span className="mt-0.5">⚠</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Simulation result */}
      {simulation !== null && (
        <div className="rounded-[var(--radius-card)] border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Transaction preview</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Network fee</span>
              <span className="font-medium tabular-nums">
                {formatBalance(simulation.fee, 8)} {simulation.feeSymbol}
              </span>
            </div>
          </div>

          {simulation.outputs.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400">
                Outputs
              </p>
              <ul className="space-y-1">
                {simulation.outputs.map((o, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="truncate font-mono text-gray-600">{o.address}</span>
                    <span className="ml-4 shrink-0 tabular-nums">
                      {formatBalance(o.amount, 8)} {o.symbol}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {simulation.sideEffects.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400">
                Side effects
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-600">
                {simulation.sideEffects.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!isBlocked && (
          <button
            onClick={() => {
              void confirmAndSign();
            }}
            disabled={stage === "signing"}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {stage === "signing" ? "Signing…" : "Confirm & sign"}
          </button>
        )}
        <button
          onClick={reset}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {isBlocked ? "Dismiss" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
