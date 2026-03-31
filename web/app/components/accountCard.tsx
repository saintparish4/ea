"use client";

import type { Account, Balance } from "@ea/types";
import { formatBalance } from "@/app/lib/format";

interface Props {
  account: Account;
  balance: Balance | null;
}

export function AccountCard({ account, balance }: Props) {
  return (
    <li className="rounded-[var(--radius-card)] border border-gray-200 bg-white p-4 shadow-xs">
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400">
        {account.chain}
      </p>
      <p className="mb-3 truncate font-mono text-sm text-gray-700">{account.address}</p>
      {balance !== null ? (
        <p className="text-2xl font-semibold tabular-nums">
          {formatBalance(balance.amount, balance.decimals)}{" "}
          <span className="text-base font-normal text-gray-500">{balance.symbol}</span>
        </p>
      ) : (
        <p className="text-sm text-gray-400">Balance loading…</p>
      )}
      {account.label !== undefined && <p className="mt-2 text-xs text-gray-400">{account.label}</p>}
    </li>
  );
}
