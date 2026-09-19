import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { InstalledSkill, JevRouterConfig } from "../types.js";
import { logger } from "../utils/logger.js";

function parseFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!match || !match[1]) return {};

  const frontmatter = match[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch ? nameMatch[1]?.trim().replace(/^["']|["']$/g, "") : undefined,
    description: descMatch
      ? descMatch[1]?.trim().replace(/^["']|["']$/g, "")
      : undefined,
  };
}

export function scanSkills(
  cwd: string = process.cwd(),
  config?: JevRouterConfig
): InstalledSkill[] {
  const homeDir = os.homedir();
  const skillsMap = new Map<string, InstalledSkill>();

  // Workspace-local candidate directories
  const localDirs = [
    { dir: path.resolve(cwd, ".opencode", "skills"), source: "workspace" as const },
    { dir: path.resolve(cwd, ".agents", "skills"), source: "workspace" as const },
    { dir: path.resolve(cwd, ".claude", "skills"), source: "workspace" as const },
  ];

  // User-global candidate directories
  const globalDirs = [
    { dir: path.resolve(homeDir, ".config", "opencode", "skills"), source: "global" as const },
    { dir: path.resolve(homeDir, ".agents", "skills"), source: "global" as const },
    { dir: path.resolve(homeDir, ".claude", "skills"), source: "global" as const },
    {
      dir: path.resolve(homeDir, ".gemini", "antigravity-ide", "builtin", "skills"),
      source: "global" as const,
    },
  ];

  // Extra paths from config
  const extraDirs = (config?.skills.extra_paths || []).map((p) => ({
    dir: path.isAbsolute(p) ? p : path.resolve(cwd, p),
    source: "custom" as const,
  }));

  const allScanTargets = [...localDirs, ...extraDirs, ...globalDirs];

  for (const target of allScanTargets) {
    if (!fs.existsSync(target.dir)) continue;

    try {
      const entries = fs.readdirSync(target.dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillFolder = path.join(target.dir, entry.name);
        const skillFilePath = path.join(skillFolder, "SKILL.md");

        if (fs.existsSync(skillFilePath)) {
          try {
            const content = fs.readFileSync(skillFilePath, "utf-8");
            const { name, description } = parseFrontmatter(content);
            const skillName = name || entry.name;
            const skillDesc =
              description || `Skill for ${skillName} located at ${skillFolder}`;

            // Workspace skills take precedence over global ones if same name
            if (!skillsMap.has(skillName)) {
              skillsMap.set(skillName, {
                name: skillName,
                description: skillDesc,
                filePath: skillFilePath,
                source: target.source,
              });
              logger.debug(`Found skill [${skillName}] from ${target.source} at ${skillFilePath}`);
            }
          } catch (err) {
            logger.warn(`Failed to read skill file at ${skillFilePath}: ${String(err)}`);
          }
        }
      }
    } catch (err) {
      logger.warn(`Error scanning directory ${target.dir}: ${String(err)}`);
    }
  }

  return Array.from(skillsMap.values());
}
