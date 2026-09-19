import * as crypto from "node:crypto";
import { logger } from "../utils/logger.js";

interface SessionEntry {
  attempts: number;
  lastUpdated: number;
}

export class RetryManager {
  private sessions = new Map<string, SessionEntry>();
  private readonly ttlMs = 1000 * 60 * 60; // 1 hour

  public getSessionKey(sessionId?: string, taskIntent?: string): string {
    if (sessionId && sessionId.trim().length > 0) {
      return sessionId.trim();
    }
    if (taskIntent && taskIntent.trim().length > 0) {
      return crypto
        .createHash("sha256")
        .update(taskIntent.trim().slice(0, 200))
        .digest("hex")
        .slice(0, 16);
    }
    return "default-session";
  }

  public recordAttempt(
    key: string,
    maxRetries: number
  ): { attempt: number; maxRetries: number; isExceeded: boolean } {
    this.cleanupExpired();

    const existing = this.sessions.get(key);
    const attempt = (existing ? existing.attempts : 0) + 1;

    this.sessions.set(key, {
      attempts: attempt,
      lastUpdated: Date.now(),
    });

    const isExceeded = attempt > maxRetries;
    logger.info(
      `Session [${key}] recorded attempt ${attempt}/${maxRetries} (Exceeded: ${isExceeded})`
    );

    return {
      attempt,
      maxRetries,
      isExceeded,
    };
  }

  public resetSession(key: string): void {
    if (this.sessions.has(key)) {
      this.sessions.delete(key);
      logger.debug(`Session [${key}] reset after successful approval.`);
    }
  }

  public getAttempts(key: string): number {
    return this.sessions.get(key)?.attempts ?? 0;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.sessions.entries()) {
      if (now - entry.lastUpdated > this.ttlMs) {
        this.sessions.delete(key);
      }
    }
  }
}

export const retryManager = new RetryManager();
