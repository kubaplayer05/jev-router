import { describe, it, expect } from "vitest";
import { detectPreCheckCommand } from "../src/prechecks/detector.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import * as path from "node:path";

describe("Stack Detector", () => {
  it("should detect node/typescript in current workspace", () => {
    const cwd = path.resolve(".");
    const detected = detectPreCheckCommand(cwd, DEFAULT_CONFIG);
    expect(detected).not.toBeNull();
    expect(detected?.stack).toMatch(/node|typescript/);
    expect(detected?.command).toBeDefined();
  });

  it("should respect custom command in config", () => {
    const customConfig = {
      ...DEFAULT_CONFIG,
      deterministic_checks: {
        ...DEFAULT_CONFIG.deterministic_checks,
        custom_command: "make test",
      },
    };
    const detected = detectPreCheckCommand(path.resolve("."), customConfig);
    expect(detected?.stack).toBe("custom");
    expect(detected?.command).toBe("make test");
  });

  it("should return null if deterministic checks are disabled", () => {
    const disabledConfig = {
      ...DEFAULT_CONFIG,
      deterministic_checks: {
        ...DEFAULT_CONFIG.deterministic_checks,
        enabled: false,
      },
    };
    const detected = detectPreCheckCommand(path.resolve("."), disabledConfig);
    expect(detected).toBeNull();
  });
});
