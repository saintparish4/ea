export type EaErrorCode =
  | "SANDBOX_ERROR"
  | "PERMISSION_ERROR"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "TIMEOUT_ERROR"
  | "SECURITY_BLOCK_ERROR"
  | "PLUGIN_ERROR";

interface BaseError {
  readonly code: EaErrorCode;
  readonly message: string;
  readonly cause?: Error;
}

export interface SandboxError extends BaseError {
  readonly code: "SANDBOX_ERROR";
  readonly pluginId: string;
}

export interface PermissionError extends BaseError {
  readonly code: "PERMISSION_ERROR";
  readonly pluginId: string;
  readonly attemptedAction: string;
}

export interface ValidationError extends BaseError {
  readonly code: "VALIDATION_ERROR";
  readonly field?: string;
}

export interface TimeoutError extends BaseError {
  readonly code: "TIMEOUT_ERROR";
  readonly stage: string;
  readonly limitMs: number;
  readonly elapsedMs: number;
}

export interface SecurityBlockError extends BaseError {
  readonly code: "SECURITY_BLOCK_ERROR";
  readonly pluginId: string;
  readonly reason: string;
}

export interface PluginError extends BaseError {
  readonly code: "PLUGIN_ERROR";
  readonly pluginId: string;
}

export type EaError =
  | SandboxError
  | PermissionError
  | ValidationError
  | TimeoutError
  | SecurityBlockError
  | PluginError;
