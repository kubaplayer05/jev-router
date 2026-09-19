import { describe, it, expect, beforeEach } from "vitest";
import { RetryManager } from "../src/session/retryManager.js";

describe("Retry Manager", () => {
  let manager: RetryManager;

  beforeEach(() => {
    manager = new RetryManager();
  });

  it("should generate consistent session keys from task intent", () => {
    const key1 = manager.getSessionKey(undefined, "Refactor auth controller");
    const key2 = manager.getSessionKey(undefined, "Refactor auth controller");
    expect(key1).toBe(key2);
    expect(key1.length).toBeGreaterThan(0);
  });

  it("should record attempts and signal when exceeding max retries", () => {
    const key = "test-session";
    const maxRetries = 5;

    for (let i = 1; i <= 5; i++) {
      const res = manager.recordAttempt(key, maxRetries);
      expect(res.attempt).toBe(i);
      expect(res.isExceeded).toBe(false);
    }

    // Attempt 6 should exceed
    const res6 = manager.recordAttempt(key, maxRetries);
    expect(res6.attempt).toBe(6);
    expect(res6.isExceeded).toBe(true);
  });

  it("should reset session on successful approval", () => {
    const key = "test-session-reset";
    manager.recordAttempt(key, 5);
    expect(manager.getAttempts(key)).toBe(1);

    manager.resetSession(key);
    expect(manager.getAttempts(key)).toBe(0);
  });
});
