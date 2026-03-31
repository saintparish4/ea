import type {
  TransactionSimulator,
  UnsignedTx,
  Result,
  PluginError,
  SimulationResult,
} from "@ea/types";

export class BitcoinSimulator implements TransactionSimulator {
  async simulateTransaction(tx: UnsignedTx): Promise<Result<SimulationResult, PluginError>> {
    const m = tx.metadata;
    const from = m.from;
    const to = m.to;
    const amountStr = m.amount;
    const feeStr = m.fee;

    if (
      typeof from !== "string" ||
      typeof to !== "string" ||
      typeof amountStr !== "string" ||
      typeof feeStr !== "string"
    ) {
      return {
        ok: false,
        error: {
          code: "PLUGIN_ERROR",
          pluginId: "bitcoin",
          message: "Missing bitcoin transaction metadata (from, to, amount, fee)",
        },
      };
    }

    let amount: bigint;
    let fee: bigint;
    try {
      amount = BigInt(amountStr);
      fee = BigInt(feeStr);
    } catch {
      return {
        ok: false,
        error: {
          code: "PLUGIN_ERROR",
          pluginId: "bitcoin",
          message: "Invalid amount or fee in transaction metadata",
        },
      };
    }

    const btcAmount = Number(amount) / 1e8;
    const feeBtc = Number(fee) / 1e8;

    return {
      ok: true,
      value: {
        fee,
        feeSymbol: "BTC",
        inputs: [{ address: from, amount: amount + fee, symbol: "BTC" }],
        outputs: [{ address: to, amount, symbol: "BTC" }],
        sideEffects: [`Send ${btcAmount} BTC to ${to} (fee ${feeBtc} BTC)`],
        warnings: [],
      },
    };
  }
}
