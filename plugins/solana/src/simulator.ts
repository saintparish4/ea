import { Connection, Transaction } from "@solana/web3.js";
import type {
  TransactionSimulator,
  UnsignedTx,
  SimulationResult,
  Result,
  PluginError,
} from "@ea/types";

export class SolanaSimulator implements TransactionSimulator {
  constructor(private readonly connection: Connection) {}

  async simulateTransaction(tx: UnsignedTx): Promise<Result<SimulationResult, PluginError>> {
    try {
      const transaction = Transaction.from(Buffer.from(tx.raw));

      const sim = await this.connection.simulateTransaction(transaction);

      if (sim.value.err) {
        return {
          ok: false,
          error: {
            code: "PLUGIN_ERROR",
            pluginId: "solana",
            message: JSON.stringify(sim.value.err),
          },
        };
      }

      const m = tx.metadata;
      const from = m.from;
      const to = m.to;
      const amountStr = m.amount;
      const mint = m.mint;

      if (
        typeof from !== "string" ||
        typeof to !== "string" ||
        typeof amountStr !== "string" ||
        typeof mint !== "string"
      ) {
        return {
          ok: false,
          error: {
            code: "PLUGIN_ERROR",
            pluginId: "solana",
            message: "Missing Solana transaction metadata (from, to, amount, mint)",
          },
        };
      }

      let amountLamports: bigint;
      try {
        amountLamports = BigInt(amountStr);
      } catch {
        return {
          ok: false,
          error: {
            code: "PLUGIN_ERROR",
            pluginId: "solana",
            message: "Invalid amount in transaction metadata",
          },
        };
      }

      const unitsConsumed = sim.value.unitsConsumed;
      const feeLamports = BigInt(
        unitsConsumed != null ? Math.ceil(Number(unitsConsumed) / 1e6) * 5000 : 5000,
      );

      const isSol = mint === "SOL";
      const symbol = isSol ? "SOL" : mint;
      const divisor = isSol ? 1e9 : 1e6;
      const amountDisplay = Number(amountLamports) / divisor;

      const warnFromLogs = sim.value.logs?.some((l) => l.includes("warn")) ?? false;

      const logs = sim.value.logs ?? [];

      const value: SimulationResult = {
        fee: feeLamports,
        feeSymbol: "SOL",
        inputs: [
          {
            address: from,
            amount: isSol ? amountLamports + feeLamports : amountLamports,
            symbol,
          },
        ],
        outputs: [{ address: to, amount: amountLamports, symbol }],
        sideEffects: [
          `Send ${amountDisplay} ${symbol} to ${to}`,
          ...(warnFromLogs ? ["Check simulation logs for warnings"] : []),
        ],
        warnings: warnFromLogs ? ["Check simulation logs"] : [],
        rawLogs: logs,
      };

      return { ok: true, value };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const error: PluginError = {
        code: "PLUGIN_ERROR",
        pluginId: "solana",
        message,
        ...(e instanceof Error ? { cause: e } : {}),
      };
      return { ok: false, error };
    }
  }
}
