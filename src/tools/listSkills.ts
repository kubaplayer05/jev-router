import { z } from "zod";
import { scanSkills } from "../skills/scanner.js";
import { loadConfig } from "../config.js";
import { resolveWorkingDirectory } from "../utils/workspace.js";
import { InstalledSkill } from "../types.js";

export const listSkillsSchema = {
  working_directory: z
    .string()
    .optional()
    .describe("Root directory to scan for workspace-specific skills"),
};

export async function handleListSkills(args: {
  working_directory?: string;
}): Promise<{ count: number; skills: InstalledSkill[] }> {
  const cwd = resolveWorkingDirectory(args.working_directory);
  const config = loadConfig(cwd);
  const skills = scanSkills(cwd, config);

  return {
    count: skills.length,
    skills,
  };
}
