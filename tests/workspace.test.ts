import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveWorkingDirectory } from "../src/utils/workspace.js";

describe("resolveWorkingDirectory", () => {
  const originalHostWorkspace = process.env.HOST_WORKSPACE;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jev-ws-"));
    delete process.env.HOST_WORKSPACE;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalHostWorkspace !== undefined) {
      process.env.HOST_WORKSPACE = originalHostWorkspace;
    } else {
      delete process.env.HOST_WORKSPACE;
    }
  });

  it("returns the requested path when it exists", () => {
    expect(resolveWorkingDirectory(tmpDir)).toBe(path.resolve(tmpDir));
  });

  it("falls back instead of returning a missing host path", () => {
    const missing = path.join(tmpDir, "does-not-exist");
    const resolved = resolveWorkingDirectory(missing);
    expect(resolved).not.toBe(path.resolve(missing));
    expect(fs.existsSync(resolved)).toBe(true);
  });

  it("prefers HOST_WORKSPACE when the requested path is missing", () => {
    process.env.HOST_WORKSPACE = tmpDir;
    const resolved = resolveWorkingDirectory("/nonexistent/host/path");
    expect(resolved).toBe(path.resolve(tmpDir));
  });
});
