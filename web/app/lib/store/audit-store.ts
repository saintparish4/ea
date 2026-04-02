"use client";

import { create } from "zustand";
import type { AuditEntry } from "@ea/types";
import { sampleAuditEntries } from "@/app/lib/sample-audit-entries";

const PAGE_SIZE = 50;

interface AuditFilters {
  pluginId: string;
  operation: string;
  result: "all" | "ok" | "error";
  since: number;
}

interface AuditState {
  entries: AuditEntry[];
  filters: AuditFilters;
  page: number;
  addEntry: (entry: AuditEntry) => void;
  /** Dev / empty log: load sample rows once so the audit UI is reviewable without a live pipeline. */
  seedSamplesIfEmpty: () => void;
  setFilter: (patch: Partial<AuditFilters>) => void;
  setPage: (page: number) => void;
  filteredEntries: () => AuditEntry[];
  pageCount: () => number;
  currentPage: () => AuditEntry[];
}

const defaultFilters: AuditFilters = {
  pluginId: "",
  operation: "",
  result: "all",
  since: 0,
};

export const useAuditStore = create<AuditState>((set, get) => ({
  entries: [],
  filters: defaultFilters,
  page: 0,

  addEntry(entry) {
    set((state) => ({ entries: [entry, ...state.entries].slice(0, 5_000) }));
  },

  seedSamplesIfEmpty() {
    if (process.env.NODE_ENV !== "development") return;
    set((state) => {
      if (state.entries.length > 0) return state;
      return { entries: [...sampleAuditEntries] };
    });
  },

  setFilter(patch) {
    set((state) => ({ filters: { ...state.filters, ...patch }, page: 0 }));
  },

  setPage(page) {
    set({ page });
  },

  filteredEntries() {
    const { entries, filters } = get();
    return entries.filter((e) => {
      if (filters.pluginId && e.pluginId !== filters.pluginId) return false;
      if (filters.operation && e.operation !== filters.operation) return false;
      if (filters.result !== "all" && e.result !== filters.result) return false;
      if (filters.since > 0 && e.timestamp < filters.since) return false;
      return true;
    });
  },

  pageCount() {
    return Math.max(1, Math.ceil(get().filteredEntries().length / PAGE_SIZE));
  },

  currentPage() {
    const { page } = get();
    const filtered = get().filteredEntries();
    return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  },
}));
