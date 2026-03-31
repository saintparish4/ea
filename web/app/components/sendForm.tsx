"use client";

import { useSendStore } from "@/app/lib/store/send-store";

const CHAINS = ["bitcoin", "solana"] as const;

export function SendForm() {
  const { chain, from, to, amount, stage, setField, runSimulationAndCheck } = useSendStore();

  const loading = stage === "simulating";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runSimulationAndCheck();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      <div>
        <label htmlFor="chain" className="mb-1 block text-sm font-medium text-gray-700">
          Chain
        </label>
        <select
          id="chain"
          value={chain}
          onChange={(e) => {
            setField("chain", e.target.value);
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {CHAINS.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="from" className="mb-1 block text-sm font-medium text-gray-700">
          From address
        </label>
        <input
          id="from"
          type="text"
          value={from}
          onChange={(e) => {
            setField("from", e.target.value);
          }}
          placeholder="Your address"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <label htmlFor="to" className="mb-1 block text-sm font-medium text-gray-700">
          To address
        </label>
        <input
          id="to"
          type="text"
          value={to}
          onChange={(e) => {
            setField("to", e.target.value);
          }}
          placeholder="Recipient address"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
          Amount (smallest unit)
        </label>
        <input
          id="amount"
          type="number"
          min="1"
          value={amount}
          onChange={(e) => {
            setField("amount", e.target.value);
          }}
          placeholder="e.g. 100000 satoshis"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Simulating…" : "Preview transaction"}
      </button>
    </form>
  );
}
