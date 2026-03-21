export type AuditOperation =
  | "getAccounts"
  | "getBalance"
  | "buildTransaction"
  | "simulateTransaction"
  | "prepareForSigning"
  | "onPreSign"
  | "onPostSign"
  | "loadPlugin"
  | "unloadPlugin"
  | "sign";

export type PipelineStage =
  | "build"
  | "simulate"
  | "security-check"
  | "sign"
  | "post-sign"
  | "loader";

export interface AuditEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly pluginId: string;
  readonly operation: AuditOperation;
  readonly stage: PipelineStage;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  readonly durationMs: number;
  readonly result: "ok" | "error";
  readonly errorCode?: string;
  readonly sessionId: string;
}
