"use client";

import { useEffect } from "react";
import { useAccountStore } from "@/app/lib/store/account-store";
import { AccountCard } from "@/app/components/accountCard";
import { ErrorBanner } from "@/app/components/errorBanner";

export function AccountsView() {
  const { accounts, balances, loading, error, fetchAccounts } = useAccountStore();

  useEffect(() => {
    void fetchAccounts();
    const interval = setInterval(() => {
      void fetchAccounts();
    }, 30_000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchAccounts]);

  if (error !== null) return <ErrorBanner error={error} />;

  return (
    <section>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <button
          onClick={() => {
            void fetchAccounts();
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {loading && accounts.length === 0 ? (
        <p className="text-sm text-gray-500">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-gray-500">
          No accounts found. Make sure at least one chain plugin is enabled.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={`${account.chain}:${account.address}`}
              account={account}
              balance={balances.get(account.address) ?? null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
