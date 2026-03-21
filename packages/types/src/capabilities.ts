import type { Result } from "./result";
import type { PluginError } from "./errors";

export interface Account {
  address: string;
  chain: string;
  accountIndex: number;
  label?: string;
}

export interface Balance {
  amount: bigint;
  decimals: number;
  symbol: string;
  usdValue?: number;
}

export interface TxParams {
  from: string;
  to: string;
  amount: bigint;
  chain: string;
  data?: Uint8Array;
  memo?: string;
}

export interface UnsignedTx {
  chain: string;
  raw: Uint8Array;
  metadata: Record<string, unknown>;
}

export interface SimulationEntry {
  address: string;
  amount: bigint;
  symbol: string;
}

export interface SimulationResult {
  fee: bigint;
  feeSymbol: string;
  inputs: SimulationEntry[];
  outputs: SimulationEntry[];
  sideEffects: string[];
  warnings: string[];
}

export interface SignablePayload {
  chain: string;
  data: Uint8Array;
  metadata: Record<string, unknown>;
}

export interface Signature {
  chain: string;
  data: Uint8Array;
}

export interface PreSignContext {
  pluginId: string;
  tx: UnsignedTx;
  simulation?: SimulationResult;
  fromAddress: string;
  toAddress: string;
  amount: bigint;
  chain: string;
}

export interface PostSignContext {
  pluginId: string;
  tx: UnsignedTx;
  signature: Signature;
  chain: string;
}

export interface SecurityCheckResult {
  action: "allow" | "warn" | "block";
  message: string;
  details?: string;
}

export interface AccountProvider {
  getAccounts(): Promise<Result<Account[], PluginError>>;
  getBalance(address: string): Promise<Result<Balance, PluginError>>;
}

export interface TransactionBuilder {
  buildTransaction(params: TxParams): Promise<Result<UnsignedTx, PluginError>>;
}

export interface TransactionSimulator {
  simulateTransaction(tx: UnsignedTx): Promise<Result<SimulationResult, PluginError>>;
}

export interface TransactionSigner {
  prepareForSigning(tx: UnsignedTx): Promise<Result<SignablePayload, PluginError>>;
}

export interface SecurityPlugin {
  onPreSign(context: PreSignContext): Promise<Result<SecurityCheckResult, PluginError>>;
  onPostSign?(context: PostSignContext): Promise<Result<void, PluginError>>;
}

// ChainPlugin is the union of chain-related capabilities. A plugin declares
// which of these it actually implements via its manifest capabilities[] array.
export type ChainPlugin = AccountProvider &
  Partial<TransactionBuilder & TransactionSimulator & TransactionSigner>;
