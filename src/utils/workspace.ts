import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "./logger.js";

const CONTAINER_WORKSPACE = "/workspace";

/**
 * Resolve the effective working directory for tool calls.
 *
 * Reusable across machines and users: when the server runs in Docker,
 * host absolute paths (e.g. /home/<anyuser>/Projects/foo) do not exist
 * inside the container. Instead of hardcoding per-user mirror mounts,
 * fall back to the portable /workspace mount (or HOST_WORKSPACE override).
 *
 * Resolution order:
 * 1. Requested path, if it exists.
 * 2. HOST_WORKSPACE env, if set and exists.
 * 3. /workspace, if it exists (Docker default mount).
 * 4. process.cwd() as last resort.
 */
export function resolveWorkingDirectory(requested?: string): string {
  const candidates: Array<{ dir: string; reason: string }> = [];

  if (requested) {
    candidates.push({ dir: requested, reason: "requested working_directory" });
  }

  const hostWorkspace = process.env.HOST_WORKSPACE;
  if (hostWorkspace) {
    candidates.push({ dir: hostWorkspace, reason: "HOST_WORKSPACE env" });
  }

  candidates.push({ dir: CONTAINER_WORKSPACE, reason: "container /workspace mount" });
  candidates.push({ dir: process.cwd(), reason: "process.cwd()" });

  for (const { dir, reason } of candidates) {
    try {
      if (fs.existsSync(dir)) {
        if (requested && path.resolve(dir) !== path.resolve(requested)) {
          logger.warn(
            `working_directory "${requested}" not found; falling back to ${reason} at "${dir}". ` +
              `Pass working_directory="/workspace" or mount the host path to avoid this fallback.`
          );
        } else {
          logger.debug(`Resolved working directory to "${dir}" (${reason}).`);
        }
        return path.resolve(dir);
      }
    } catch {
      // ignore and try next candidate
    }
  }

  logger.warn(
    `No working directory candidate exists; returning requested path "${requested}" unresolved.`
  );
  return requested ? path.resolve(requested) : process.cwd();
}
