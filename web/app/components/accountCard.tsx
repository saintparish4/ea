"use client";

import { useState } from "react";
import type { Account, Balance } from "@ea/types";
import { formatBalance } from "@/app/lib/format";

const customStyles = {
  conicGradient: {
    background: "conic-gradient(at top left, #c7d2fe, #475569, #c7d2fe)",
    opacity: 0.9,
  },
  radialGradient: {
    background: "radial-gradient(ellipse at center, rgba(255,255,255,0.2), transparent)",
  },
};

interface Props {
  account: Account;
  balance: Balance | null;
}

function chainBadgeStyle(chain: string): { bg: string; icon: "eth" | "btc" | "sol" | "dot" } {
  const c = chain.toLowerCase();
  if (c.includes("eth")) return { bg: "#627EEA", icon: "eth" };
  if (c.includes("btc") || c.includes("bitcoin")) return { bg: "#F7931A", icon: "btc" };
  if (c.includes("sol")) return { bg: "#9945FF", icon: "sol" };
  return { bg: "#64748b", icon: "dot" };
}

function ChainIcon({ kind }: { kind: "eth" | "btc" | "sol" | "dot" }) {
  if (kind === "eth") {
    return (
      <svg viewBox="0 0 320 512" className="h-2.5 w-2.5 fill-current text-white">
        <path d="M311.9 260.8L160 353.6 8 260.8 160 0l151.9 260.8zM160 383.4L8 290.6 160 512l152-221.4-152 92.8z" />
      </svg>
    );
  }
  if (kind === "btc") {
    return <span className="text-[10px] font-bold leading-none text-white">₿</span>;
  }
  if (kind === "sol") {
    return (
      <svg viewBox="0 0 397 311" className="h-2.5 w-2.5 fill-current text-white">
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7zM333.3 73.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.8 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.3c5.9 0 8.8-7 4.7-11.1l-62.7-62.7zM6.5 3.8h317.4c3.5 0 6.8 1.4 9.2 3.8l62.7 62.7c4.1 4.1 1.2 11.1-4.6 11.1H73.8c-3.5 0-6.8-1.4-9.2-3.8L1.9 14.9C-2.2 10.8.7 3.8 6.5 3.8z" />
      </svg>
    );
  }
  return <span className="block h-1.5 w-1.5 rounded-full bg-white/90" />;
}

export function AccountCard({ account, balance }: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const [isAddressHovered, setIsAddressHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const { bg: badgeBg, icon: badgeIcon } = chainBadgeStyle(account.chain);

  const handleCopy = () => {
    void navigator.clipboard.writeText(account.address).catch(() => {});
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const usdLine =
    balance?.usdValue !== undefined
      ? `≈ $${balance.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
      : null;

  return (
    <li
      className="animate-fade-up relative w-full max-w-[380px] overflow-hidden rounded-[28px] border border-gray-100 bg-white p-7"
      style={{
        boxShadow: "0 24px 48px -12px rgba(16,24,40,0.08)",
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full transition-transform duration-700 ease-out"
        style={{
          background: "rgba(59,130,246,0.1)",
          filter: "blur(40px)",
          transform: isHovered ? "scale(1.5)" : "scale(1)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full"
        style={{
          background: "rgba(168,85,247,0.05)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative z-10 mb-8 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 rounded-full border border-gray-200/80 px-3 py-1.5 shadow-sm"
          style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)" }}
        >
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full shadow-inner"
            style={{ backgroundColor: badgeBg }}
          >
            <ChainIcon kind={badgeIcon} />
          </div>
          <span className="pr-1 text-[11px] font-bold uppercase tracking-widest text-gray-700">
            {account.chain}
          </span>
        </div>

        {account.label !== undefined ? (
          <span className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-400">
            {account.label}
          </span>
        ) : null}
      </div>

      <div className="relative z-10 mb-10">
        <h2 className="mb-2 text-[13px] font-medium text-gray-400">Total Balance</h2>
        {balance !== null ? (
          <>
            <div className="flex items-baseline gap-2">
              <span
                className="text-[40px] font-semibold leading-none tabular-nums text-gray-900"
                style={{ letterSpacing: "-0.04em" }}
              >
                {formatBalance(balance.amount, balance.decimals)}
              </span>
              <span className="text-xl font-medium text-gray-400">{balance.symbol}</span>
            </div>
            {usdLine !== null ? (
              <p className="mt-2 text-[13px] font-medium text-gray-400">{usdLine}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-gray-400">Balance loading…</p>
        )}
      </div>

      <div
        className="relative z-10 flex cursor-pointer items-center justify-between rounded-[20px] border p-3.5 transition-all duration-300"
        style={{
          background: isAddressHovered ? "rgba(243,244,246,0.5)" : "#F8F9FA",
          borderColor: isAddressHovered ? "rgba(209,213,219,0.6)" : "rgba(229,231,235,0.6)",
        }}
        onMouseEnter={() => {
          setIsAddressHovered(true);
        }}
        onMouseLeave={() => {
          setIsAddressHovered(false);
        }}
        onClick={handleCopy}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div
            className="relative h-[34px] w-[34px] flex-shrink-0 overflow-hidden rounded-full"
            style={{
              boxShadow:
                "inset 0 1px 2px rgba(255,255,255,0.5), 0 0 0 1px rgba(0,0,0,0.05)",
            }}
          >
            <div className="absolute inset-0" style={customStyles.conicGradient} />
            <div className="absolute inset-0" style={customStyles.radialGradient} />
          </div>

          <div className="min-w-0 flex-1 flex-col">
            <span className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Address
            </span>
            <span className="block truncate font-mono text-[13px] font-medium tracking-tight text-gray-700">
              {account.address}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-transparent bg-white shadow-sm transition-all duration-200 hover:border-gray-200 hover:shadow"
          style={{
            opacity: isAddressHovered ? 1 : 0,
            transform: isAddressHovered ? "scale(1)" : "scale(0.95)",
            color: copied ? "#10b981" : "#9ca3af",
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          title={copied ? "Copied!" : "Copy address"}
        >
          {copied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </li>
  );
}
