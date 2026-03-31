import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
import { mnemonicToSeedSync } from "bip39";
import type { AccountProvider, Account, Balance, Result, PluginError } from "@ea/types";

export function deriveSolanaKeypair(mnemonic: string, accountIndex: number): Keypair {
  const seed = mnemonicToSeedSync(mnemonic);
  // BIP44: m/44'/501'/accountIndex'/0'
  const path = `m/44'/501'/${accountIndex}'/0'`;
  const { key } = derivePath(path, seed.toString("hex"));
  return Keypair.fromSeed(key);
}

export class SolanaAccountProvider implements AccountProvider {
  constructor(
    private readonly mnemonic: string,
    private readonly connection: Connection,
  ) {}

  async getAccounts(): Promise<Result<Account[], never>> {
    const accounts: Account[] = [0, 1, 2].map((i) => {
      const kp = deriveSolanaKeypair(this.mnemonic, i);
      return { address: kp.publicKey.toBase58(), chain: "solana", accountIndex: i };
    });
    return { ok: true, value: accounts };
  }

  async getBalance(address: string): Promise<Result<Balance, PluginError>> {
    try {
      const lamports = await this.connection.getBalance(new PublicKey(address));
      return {
        ok: true,
        value: { amount: BigInt(lamports), decimals: 9, symbol: "SOL" },
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
