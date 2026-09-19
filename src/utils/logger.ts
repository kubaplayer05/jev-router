/**
 * Stderr-only logger for MCP servers.
 *
 * CRITICAL: The Model Context Protocol communicates over stdin/stdout.
 * Writing any text to stdout will corrupt the JSON-RPC communication stream.
 * All logs, diagnostics, and debugging messages must strictly go to stderr.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const currentLevel: LogLevel =
  process.env.JEV_DEBUG === "true" || process.env.DEBUG === "true"
    ? LogLevel.DEBUG
    : LogLevel.INFO;

function formatMessage(level: string, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [jev-router] [${level}]`;
  if (meta !== undefined) {
    const metaStr =
      typeof meta === "object" ? JSON.stringify(meta) : String(meta);
    return `${prefix} ${message} ${metaStr}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, meta?: unknown): void {
    if (currentLevel <= LogLevel.DEBUG) {
      console.error(formatMessage("DEBUG", message, meta));
    }
  },

  info(message: string, meta?: unknown): void {
    if (currentLevel <= LogLevel.INFO) {
      console.error(formatMessage("INFO", message, meta));
    }
  },

  warn(message: string, meta?: unknown): void {
    if (currentLevel <= LogLevel.WARN) {
      console.error(formatMessage("WARN", message, meta));
    }
  },

  error(message: string, meta?: unknown): void {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(formatMessage("ERROR", message, meta));
    }
  },
};
