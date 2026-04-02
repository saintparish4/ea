"use client";

import { useCallback, useId, useState, type KeyboardEvent } from "react";
import type { AuditEntry, PipelineStage } from "@ea/types";

interface Props {
  entry: AuditEntry;
}

const GRID_COLS = "56px minmax(250px,1fr) 140px 100px 140px 56px" as const;

function safeJson(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable]";
  }
}

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ErrorIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    className="audit-chevron"
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

function StageIcon({ stage }: { stage: PipelineStage }) {
  const common = {
    xmlns: "http://www.w3.org/2000/svg" as const,
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (stage) {
    case "build":
      return (
        <svg {...common}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "simulate":
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9" />
        </svg>
      );
    case "security-check":
      return (
        <svg {...common}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "sign":
      return (
        <svg {...common}>
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7 21l-4 1 1-4L17 3z" />
        </svg>
      );
    case "post-sign":
      return (
        <svg {...common}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "loader":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

function ExpandedPanel({ entry }: { entry: AuditEntry }) {
  const isError = entry.result === "error";
  const borderTone = isError ? "border-rose-100" : "border-slate-100";

  return (
    <div
      className={`px-4 py-4 pb-6 sm:px-14 grid gap-6 border-t ${borderTone} sm:grid-cols-2`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="space-y-4">
        <div>
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Request context
          </h4>
          <dl className="grid gap-y-2 text-sm" style={{ gridTemplateColumns: "100px 1fr" }}>
            <dt className="text-slate-500">Session</dt>
            <dd className="font-mono text-slate-800 text-xs break-all">{entry.sessionId}</dd>
            <dt className="text-slate-500">Plugin</dt>
            <dd className="font-mono text-slate-800 text-xs break-all">{entry.pluginId}</dd>
            <dt className="text-slate-500">Operation</dt>
            <dd className="font-mono text-slate-800 text-xs">{entry.operation}</dd>
            <dt className="text-slate-500">Stage</dt>
            <dd className="font-mono text-slate-800 text-xs">{entry.stage}</dd>
          </dl>
        </div>
        {isError && (
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Error details
            </h4>
            <dl className="grid gap-y-2 text-sm" style={{ gridTemplateColumns: "100px 1fr" }}>
              <dt className="text-slate-500">Code</dt>
              <dd className="font-mono text-rose-600 text-xs font-medium">
                {entry.errorCode ?? "?"}
              </dd>
            </dl>
          </div>
        )}
      </div>
      <div className="space-y-4 min-w-0">
        <div>
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Input
          </h4>
          <div className="bg-[#1e293b] rounded-lg p-3 overflow-x-auto border border-slate-700">
            <pre className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
              <code>{safeJson(entry.input)}</code>
            </pre>
          </div>
        </div>
        <div>
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Output
          </h4>
          <div className="bg-[#1e293b] rounded-lg p-3 overflow-x-auto border border-slate-700">
            <pre className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
              <code>{safeJson(entry.output)}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuditEntryRow({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const isError = entry.result === "error";
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const statusLabel = isError ? `error:${entry.errorCode ?? "?"}` : "ok";

  const toggle = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return (
    <div
      className={`audit-entry-row group flex flex-col relative transition-colors duration-200 ${
        isError ? "bg-rose-50/30 hover:bg-rose-50/60" : "hover:bg-slate-50/80"
      } ${expanded ? "is-expanded" : ""}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full ${isError ? "bg-rose-500" : "bg-emerald-500"}`} />

      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="grid items-center px-2 py-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
        style={{ gridTemplateColumns: GRID_COLS }}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        <div className="flex justify-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              isError ? "bg-rose-100 text-rose-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {isError ? <ErrorIcon /> : <CheckIcon />}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{entry.operation}</span>
            {isError ? (
              <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                {statusLabel}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                {statusLabel}
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-slate-500 truncate" title={entry.pluginId}>
            {entry.pluginId}
          </span>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200/60">
            <StageIcon stage={entry.stage} />
            {entry.stage}
          </span>
        </div>

        <div
          className={`text-right font-mono text-sm tabular-nums ${
            isError ? "text-rose-600 font-medium" : "text-slate-600"
          }`}
        >
          {entry.durationMs}ms
        </div>

        <div className="text-right pr-4 font-mono text-xs text-slate-500 tabular-nums">{time}</div>

        <div className="flex justify-center text-slate-400 group-hover:text-slate-600">
          <ChevronIcon />
        </div>
      </div>

      <div
        id={panelId}
        role="region"
        aria-hidden={!expanded}
        className={`audit-entry-row-expandable ${isError ? "bg-white" : "bg-slate-50/50"}`}
      >
        <div className="audit-entry-row-expandable-inner">
          <ExpandedPanel entry={entry} />
        </div>
      </div>
    </div>
  );
}
