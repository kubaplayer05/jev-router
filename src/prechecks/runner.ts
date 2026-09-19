import { exec } from "node:child_process";
import { DeterministicCheckResult, JevRouterConfig } from "../types.js";
import { detectPreCheckCommand } from "./detector.js";
import { logger } from "../utils/logger.js";

export async function runPreCheck(
  cwd: string,
  config: JevRouterConfig
): Promise<DeterministicCheckResult | undefined> {
  const detected = detectPreCheckCommand(cwd, config);
  if (!detected) {
    logger.debug("No pre-check command detected or deterministic checks disabled.");
    return undefined;
  }

  const { stack, command } = detected;
  logger.info(`Running deterministic pre-check for [${stack}]: "${command}" in ${cwd}`);
  const start = Date.now();

  return new Promise<DeterministicCheckResult>((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: config.deterministic_checks.timeout_ms,
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        if (error) {
          logger.warn(`Deterministic pre-check failed (${durationMs}ms): ${command}`);
          const combinedOutput = (stderr || stdout || error.message).trim();
          resolve({
            passed: false,
            command,
            stack,
            output: combinedOutput,
            durationMs,
          });
        } else {
          logger.info(`Deterministic pre-check passed (${durationMs}ms): ${command}`);
          resolve({
            passed: true,
            command,
            stack,
            output: stdout.trim(),
            durationMs,
          });
        }
      }
    );
  });
}
