"use client";

import { create } from "zustand";
import type { Account, AccountProvider, Balance, EaError } from "@ea/types";
import { getRuntime, initRuntime } from "../runtime";

interface AccountState {
  accounts: Account[];
  balances: Map<string, Balance>;
  loading: boolean;
  error: EaError | null;
  fetchAccounts: () => Promise<void>;
  refreshBalance: (address: string) => Promise<void>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  balances: new Map(),
  loading: false,
  error: null,

  async fetchAccounts() {
    set({ loading: true, error: null });
    await initRuntime();
    const { registry } = getRuntime();
    const chainPlugins = registry.listEnabledByType("chain");
    const allAccounts: Account[] = [];

    for (const record of chainPlugins) {
      if (!record.enabled) continue;
      const result = await (record.instance as AccountProvider).getAccounts();
      if (result.ok) {
        allAccounts.push(...result.value);
      }
    }

    set({ accounts: allAccounts, loading: false });

    // Kick off balance fetches without blocking
    for (const account of allAccounts) {
      get()
        .refreshBalance(account.address)
        .catch(() => undefined);
    }
  },

  async refreshBalance(address: string) {
    await initRuntime();
    const { registry } = getRuntime();
    const chainPlugins = registry.listEnabledByType("chain");

    for (const record of chainPlugins) {
      if (!record.enabled) continue;
      const result = await (record.instance as AccountProvider).getBalance(address);
      if (result.ok) {
        set((state) => ({
          balances: new Map(state.balances).set(address, result.value),
        }));
        return;
      }
    }
  },
}));
