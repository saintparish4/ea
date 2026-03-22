export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  pluginId?: string;
  operation?: string;
  stage?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context: LogContext;
}

// Logger is the interface the rest of the codebase depends on.
// Swap out the implementation (console, pino, etc.) without touching callers.
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => noopLogger,
};

export function createConsoleLogger(defaultContext: LogContext = {}): Logger {
  const emit = (level: LogLevel, message: string, context: LogContext = {}): void => {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: { ...defaultContext, ...context },
    };
    const line = JSON.stringify(entry);
    if (level === "error") {
      // eslint-disable-next-line no-console
      console.error(line);
    } else if (level === "warn") {
      // eslint-disable-next-line no-console
      console.warn(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  };

  return {
    debug: (msg, ctx) => emit("debug", msg, ctx),
    info: (msg, ctx) => emit("info", msg, ctx),
    warn: (msg, ctx) => emit("warn", msg, ctx),
    error: (msg, ctx) => emit("error", msg, ctx),
    child: (ctx) => createConsoleLogger({ ...defaultContext, ...ctx }),
  };
}
