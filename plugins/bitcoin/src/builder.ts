import * as bitcoin from "bitcoinjs-lib";
import type { TransactionBuilder, TxParams, UnsignedTx, Result, PluginError } from "@ea/types";
import { esploraApiBase } from "./esplora";

interface Utxo {
  txid: string;
  vout: number;
  value: number;
}

export class BitcoinTxBuilder implements TransactionBuilder {
  constructor(private readonly network: bitcoin.Network = bitcoin.networks.bitcoin) {}

  async buildTransaction(params: TxParams): Promise<Result<UnsignedTx, PluginError>> {
    const { from, to, amount } = params;

    const utxos = await this.fetchUtxos(from);
    if (utxos.length === 0) {
      return {
        ok: false,
        error: { code: "PLUGIN_ERROR", pluginId: "bitcoin", message: "No UTXOs available" },
      };
    }

    const psbt = new bitcoin.Psbt({ network: this.network });
    let inputSum = BigInt(0);

    for (const utxo of utxos) {
      psbt.addInput({ hash: utxo.txid, index: utxo.vout });
      inputSum += BigInt(utxo.value);
    }

    const feeRate = 5n;
    const estimatedSize = BigInt(utxos.length * 68 + 2 * 31 + 10);
    const fee = feeRate * estimatedSize;
    const change = inputSum - amount - fee;

    if (inputSum < amount + fee) {
      return {
        ok: false,
        error: { code: "PLUGIN_ERROR", pluginId: "bitcoin", message: "Insufficient funds" },
      };
    }

    psbt.addOutput({ address: to, value: amount });
    if (change > 546n) {
      psbt.addOutput({ address: from, value: change });
    }

    return {
      ok: true,
      value: {
        chain: "bitcoin",
        raw: Uint8Array.from(psbt.toBuffer()),
        metadata: { from, to, amount: amount.toString(), fee: fee.toString() },
      },
    };
  }

  private async fetchUtxos(address: string): Promise<Utxo[]> {
    const res = await fetch(`${esploraApiBase(this.network)}/address/${address}/utxo`);
    if (!res.ok) return [];
    return (await res.json()) as Utxo[];
  }
}
