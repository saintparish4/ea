import { Connection, clusterApiUrl } from "@solana/web3.js";
import { SolanaAccountProvider } from "./accounts";
import { SolanaTxBuilder } from "./builder";
import { SolanaSimulator } from "./simulator";
import { manifest } from "./manifest";

const DEV_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const connection = new Connection(clusterApiUrl("devnet"));
const accountProvider = new SolanaAccountProvider(DEV_MNEMONIC, connection);
const txBuilder = new SolanaTxBuilder(connection);
const simulator = new SolanaSimulator(connection);

export const plugin = Object.assign(accountProvider, {
  buildTransaction: txBuilder.buildTransaction.bind(txBuilder),
  simulateTransaction: simulator.simulateTransaction.bind(simulator),
});

export { SolanaAccountProvider, deriveSolanaKeypair } from "./accounts";
export { SolanaTxBuilder } from "./builder";
export { SolanaSimulator } from "./simulator";
export { manifest };
