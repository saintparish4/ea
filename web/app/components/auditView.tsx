"use client";

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
  const { filters, page, setFilter, setPage, pageCount, currentPage } = useAuditStore();
  const entries = currentPage();
  const totalPages = pageCount();

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
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                {["Time", "Plugin", "Operation", "Stage", "Duration", "Result"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <AuditEntryRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
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
