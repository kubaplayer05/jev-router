import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig, DEFAULT_CONFIG } from "../src/config.js";

describe("Config Loader", () => {
  beforeEach(() => {
    delete process.env.JEV_MAX_RETRIES;
  });

  it("should return default configuration when no config file exists", () => {
    const config = loadConfig("/non/existent/path");
    expect(config.max_retries).toBe(5);
    expect(config.thresholds.min_code_quality).toBe(3.8);
    expect(config.thresholds.min_plan_clarity).toBe(3.5);
    expect(config.thresholds.min_safety_confidence).toBe(0.8);
    expect(config.deterministic_checks.enabled).toBe(true);
  });

  it("should allow environment variable override for max retries", () => {
    process.env.JEV_MAX_RETRIES = "7";
    const config = loadConfig("/non/existent/path");
    expect(config.max_retries).toBe(7);
  });
});
