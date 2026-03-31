import * as bitcoin from "bitcoinjs-lib";
import { BitcoinAccountProvider } from "./accounts";
import { BitcoinTxBuilder } from "./builder";
import { BitcoinSimulator } from "./simulator";
import { manifest } from "./manifest";

/** Dev mnemonic — keep in sync with web `initRuntime` / `InMemoryKeyProvider.initialize`. */
const DEV_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const network = bitcoin.networks.bitcoin;
const accountProvider = new BitcoinAccountProvider(DEV_MNEMONIC, network);
const txBuilder = new BitcoinTxBuilder(network);
const simulator = new BitcoinSimulator();

export const plugin = Object.assign(accountProvider, {
  buildTransaction: txBuilder.buildTransaction.bind(txBuilder),
  simulateTransaction: simulator.simulateTransaction.bind(simulator),
});

export { BitcoinAccountProvider, deriveP2WPKH } from "./accounts";
export { BitcoinTxBuilder } from "./builder";
export { BitcoinSimulator } from "./simulator";
export { manifest };
