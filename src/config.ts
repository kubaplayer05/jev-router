import * as fs from "node:fs";
import * as path from "node:path";
import { JevRouterConfig } from "./types.js";
import { logger } from "./utils/logger.js";

export const DEFAULT_CONFIG: JevRouterConfig = {
  max_retries: 5,
  thresholds: {
    min_code_quality: 3.8,
    min_plan_clarity: 3.5,
    min_safety_confidence: 0.8,
  },
  deterministic_checks: {
    enabled: true,
    timeout_ms: 20000,
  },
  skills: {
    extra_paths: [],
  },
};

const CONFIG_FILENAMES = [
  "jev-router.config.json",
  ".jev-routerrc.json",
  ".jev-routerrc",
];

export function loadConfig(cwd: string = process.cwd()): JevRouterConfig {
  let loadedConfig: Partial<JevRouterConfig> = {};

  for (const filename of CONFIG_FILENAMES) {
    const filePath = path.resolve(cwd, filename);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        loadedConfig = parsed;
        logger.info(`Loaded configuration from ${filePath}`);
        break;
      } catch (err) {
        logger.warn(
          `Failed to parse config file at ${filePath}: ${String(err)}`
        );
      }
    }
  }

  // Environment overrides
  const envMaxRetries = process.env.JEV_MAX_RETRIES
    ? parseInt(process.env.JEV_MAX_RETRIES, 10)
    : undefined;

  return {
    max_retries:
      envMaxRetries && !isNaN(envMaxRetries)
        ? envMaxRetries
        : loadedConfig.max_retries ?? DEFAULT_CONFIG.max_retries,
    thresholds: {
      min_code_quality:
        loadedConfig.thresholds?.min_code_quality ??
        DEFAULT_CONFIG.thresholds.min_code_quality,
      min_plan_clarity:
        loadedConfig.thresholds?.min_plan_clarity ??
        DEFAULT_CONFIG.thresholds.min_plan_clarity,
      min_safety_confidence:
        loadedConfig.thresholds?.min_safety_confidence ??
        DEFAULT_CONFIG.thresholds.min_safety_confidence,
    },
    deterministic_checks: {
      enabled:
        loadedConfig.deterministic_checks?.enabled ??
        DEFAULT_CONFIG.deterministic_checks.enabled,
      custom_command: loadedConfig.deterministic_checks?.custom_command,
      timeout_ms:
        loadedConfig.deterministic_checks?.timeout_ms ??
        DEFAULT_CONFIG.deterministic_checks.timeout_ms,
    },
    skills: {
      extra_paths: [
        ...(DEFAULT_CONFIG.skills.extra_paths || []),
        ...(loadedConfig.skills?.extra_paths || []),
      ],
    },
  };
}
