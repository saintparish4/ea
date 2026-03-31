import * as bitcoin from "bitcoinjs-lib";

/** Blockstream Esplora HTTP API (browser CORS). */
export function esploraApiBase(network: bitcoin.Network): string {
  return network === bitcoin.networks.testnet
    ? "https://blockstream.info/testnet/api"
    : "https://blockstream.info/api";
}
