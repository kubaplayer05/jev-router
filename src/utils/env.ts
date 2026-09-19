import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { logger } from "./logger.js";

let loaded = false;

export function loadEnvironment(): void {
  if (loaded) return;
  loaded = true;

  const candidatePaths: string[] = [];

  // 1. Current working directory .env
  const cwdEnv = path.resolve(process.cwd(), ".env");
  candidatePaths.push(cwdEnv);

  // 2. Project root directory where jev-router source/dist lives
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRootEnv = path.resolve(currentDir, "..", ".env");
    if (!candidatePaths.includes(projectRootEnv)) {
      candidatePaths.push(projectRootEnv);
    }
  } catch {
    // ignore
  }

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const result = dotenv.config({ path: envPath });
        if (!result.error) {
          logger.debug(`Loaded environment variables from ${envPath}`);
        }
      } catch (err) {
        logger.warn(`Failed to parse env file at ${envPath}: ${String(err)}`);
      }
    }
  }
}

// Automatically load on import
loadEnvironment();
