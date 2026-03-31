import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { TransactionBuilder, TxParams, UnsignedTx, Result, PluginError } from "@ea/types";

export class SolanaTxBuilder implements TransactionBuilder {
  constructor(private readonly connection: Connection) {}

  async buildTransaction(params: TxParams): Promise<Result<UnsignedTx, PluginError>> {
    const { from, to, amount, mint } = params as {
      from: string;
      to: string;
      amount: bigint;
      mint?: string; // if present, SPL token transfer
    };

    try {
      const { blockhash } = await this.connection.getLatestBlockhash();
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: new PublicKey(from),
      });

      if (mint) {
        const mintPubkey = new PublicKey(mint);
        const fromAta = getAssociatedTokenAddressSync(mintPubkey, new PublicKey(from));
        const toAta = getAssociatedTokenAddressSync(mintPubkey, new PublicKey(to));
        tx.add(createTransferInstruction(fromAta, toAta, new PublicKey(from), Number(amount)));
      } else {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(from),
            toPubkey: new PublicKey(to),
            lamports: Number(amount),
          }),
        );
      }

      const raw = tx.serialize({ requireAllSignatures: false });
      return {
        ok: true,
        value: {
          chain: "solana",
          raw: Uint8Array.from(raw),
          metadata: { from, to, amount: amount.toString(), mint: mint ?? "SOL" },
        },
      };
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
