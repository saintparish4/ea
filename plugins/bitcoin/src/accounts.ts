import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { BIP32Factory } from "bip32";
import { mnemonicToSeedSync } from "bip39";
import type { AccountProvider, Account, Balance, Result, PluginError } from "@ea/types";
import { esploraApiBase } from "./esplora";

const bip32 = BIP32Factory(ecc);

export function deriveP2WPKH(
  mnemonic: string,
  accountIndex: number,
  network: bitcoin.Network = bitcoin.networks.bitcoin,
): string {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  // BIP84: m/84'/0'/accountIndex'/0/0
  const child = root.derivePath(`84'/0'/${accountIndex}'/0/0`);
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network,
  });
  if (!address) throw new Error("Failed to derive address");
  return address;
}

export class BitcoinAccountProvider implements AccountProvider {
  constructor(
    private readonly mnemonic: string,
    private readonly network: bitcoin.Network = bitcoin.networks.bitcoin,
  ) {}

  async getAccounts(): Promise<Result<Account[], never>> {
    const accounts: Account[] = [0, 1, 2].map((i) => ({
      address: deriveP2WPKH(this.mnemonic, i, this.network),
      chain: "bitcoin",
      accountIndex: i,
    }));
    return { ok: true, value: accounts };
  }

  async getBalance(address: string): Promise<Result<Balance, PluginError>> {
    const res = await fetch(`${esploraApiBase(this.network)}/address/${address}`);
    if (!res.ok) {
      return {
        ok: false,
        error: {
          code: "PLUGIN_ERROR",
          pluginId: "bitcoin",
          message: `HTTP ${res.status}`,
        },
      };
    }
    const data = (await res.json()) as {
      chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
    };
    return {
      ok: true,
      value: {
        amount: BigInt(data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum),
        decimals: 8,
        symbol: "BTC",
      },
    };
  }
}
