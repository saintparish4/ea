"use client";

import { useEffect } from "react";
import { useAuditStore } from "@/app/lib/store/audit-store";
import { AuditEntryRow } from "@/app/components/audit-entry-row";

const OPERATIONS = [
  "getAccounts",
  "getBalance",
  "buildTransaction",
  "simulateTransaction",
  "prepareForSigning",
  "onPreSign",
  "onPostSign",
  "sign",
] as const;

export function AuditView() {
  const { filters, page, setFilter, setPage, pageCount, currentPage, seedSamplesIfEmpty } =
    useAuditStore();
  const entries = currentPage();
  const totalPages = pageCount();

  useEffect(() => {
    seedSamplesIfEmpty();
  }, [seedSamplesIfEmpty]);

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">Audit Log</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Plugin ID…"
          value={filters.pluginId}
          onChange={(e) => {
            setFilter({ pluginId: e.target.value });
          }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <select
          value={filters.operation}
          onChange={(e) => {
            setFilter({ operation: e.target.value });
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All operations</option>
          {OPERATIONS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>

        <select
          value={filters.result}
          onChange={(e) => {
            setFilter({ result: e.target.value as "all" | "ok" | "error" });
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All results</option>
          <option value="ok">OK</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No audit entries match the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-slate-200 bg-white">
          <div
            className="grid items-center px-2 py-3 bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider"
            style={{
              gridTemplateColumns: "56px minmax(250px,1fr) 140px 100px 140px 56px",
            }}
          >
            <div className="text-center">Status</div>
            <div>Operation / Plugin</div>
            <div>Stage</div>
            <div className="text-right">Duration</div>
            <div className="text-right pr-4">Time</div>
            <div />
          </div>
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <AuditEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <button
            disabled={page === 0}
            onClick={() => {
              setPage(page - 1);
            }}
            className="rounded border border-gray-200 px-3 py-1 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => {
              setPage(page + 1);
            }}
            className="rounded border border-gray-200 px-3 py-1 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
