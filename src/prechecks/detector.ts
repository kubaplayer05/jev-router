import * as fs from "node:fs";
import * as path from "node:path";
import { JevRouterConfig } from "../types.js";

export interface DetectedStack {
  stack: string;
  command: string;
  source: "config" | "detected";
}

export function detectPreCheckCommand(
  cwd: string,
  config: JevRouterConfig
): DetectedStack | null {
  if (!config.deterministic_checks.enabled) {
    return null;
  }

  // 1. Check custom override in config
  if (config.deterministic_checks.custom_command) {
    return {
      stack: "custom",
      command: config.deterministic_checks.custom_command,
      source: "config",
    };
  }

  // 2. Node / TypeScript
  const pkgJsonPath = path.resolve(cwd, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    // Detect package manager from lockfile
    let pm = "npm";
    if (fs.existsSync(path.resolve(cwd, "pnpm-lock.yaml"))) {
      pm = "pnpm";
    } else if (fs.existsSync(path.resolve(cwd, "yarn.lock"))) {
      pm = "yarn";
    } else if (fs.existsSync(path.resolve(cwd, "bun.lockb"))) {
      pm = "bun";
    }

    try {
      const raw = fs.readFileSync(pkgJsonPath, "utf-8");
      const pkg = JSON.parse(raw);
      if (pkg.scripts && pkg.scripts.lint) {
        return { stack: "node-lint", command: `${pm} run lint`, source: "detected" };
      }
    } catch {
      // ignore
    }
    const tsconfigPath = path.resolve(cwd, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      return { stack: "typescript", command: `${pm} exec tsc --noEmit`, source: "detected" };
    }
    return { stack: "node", command: `${pm} test --if-present`, source: "detected" };
  }

  // 3. Rust
  const cargoPath = path.resolve(cwd, "Cargo.toml");
  if (fs.existsSync(cargoPath)) {
    return { stack: "rust", command: "cargo check --quiet", source: "detected" };
  }

  // 4. Go
  const goModPath = path.resolve(cwd, "go.mod");
  if (fs.existsSync(goModPath)) {
    return { stack: "go", command: "go vet ./...", source: "detected" };
  }

  // 5. Elixir
  const mixPath = path.resolve(cwd, "mix.exs");
  if (fs.existsSync(mixPath)) {
    return {
      stack: "elixir",
      command: "mix compile --warnings-as-errors",
      source: "detected",
    };
  }

  // 6. Python
  const pyprojectPath = path.resolve(cwd, "pyproject.toml");
  const reqsPath = path.resolve(cwd, "requirements.txt");
  if (fs.existsSync(pyprojectPath) || fs.existsSync(reqsPath)) {
    return { stack: "python", command: "ruff check . || flake8 .", source: "detected" };
  }

  // 7. Ruby
  const gemfilePath = path.resolve(cwd, "Gemfile");
  if (fs.existsSync(gemfilePath)) {
    return {
      stack: "ruby",
      command: "bundle exec rubocop",
      source: "detected",
    };
  }

  return null;
}
