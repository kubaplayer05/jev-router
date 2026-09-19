import { z } from "zod";
import { jevEngine } from "../jev/client.js";
import { TASK_ASSESSMENT_QUESTIONS } from "../jev/rubrics.js";
import { scanSkills } from "../skills/scanner.js";
import { matchSkillsForTask } from "../skills/matcher.js";
import { loadConfig } from "../config.js";
import { resolveWorkingDirectory } from "../utils/workspace.js";
import {
  ComplexityTier,
  ReasoningBudget,
  TaskAssessmentResult,
} from "../types.js";
import { logger } from "../utils/logger.js";

export const assessTaskSchema = {
  task_description: z
    .string()
    .describe("The user's original task request or prompt to evaluate"),
  context_files: z
    .array(z.string())
    .optional()
    .describe("List of files currently open, active, or mentioned in the prompt"),
  working_directory: z
    .string()
    .optional()
    .describe("Root directory of the workspace to scan for skills and config"),
};

export async function handleAssessTask(args: {
  task_description: string;
  context_files?: string[];
  working_directory?: string;
}): Promise<TaskAssessmentResult> {
  const cwd = resolveWorkingDirectory(args.working_directory);
  const config = loadConfig(cwd);

  logger.info(`Assessing task: "${args.task_description.slice(0, 80)}..."`);

  // 1. Scan and match skills
  const installedSkills = scanSkills(cwd, config);
  const recommendedSkills = await matchSkillsForTask(
    args.task_description,
    installedSkills
  );

  // 2. Query Jev System One for task complexity & budget
  const assessmentResult = await jevEngine.evaluate({
    state: `Task Description: ${args.task_description}\nContext Files: ${(
      args.context_files || []
    ).join(", ")}`,
    questions: TASK_ASSESSMENT_QUESTIONS,
  });

  const answers = assessmentResult.answers as any;
  const complexity: ComplexityTier =
    answers.complexity?.choice || "localized_logic";
  const reasoningBudget: ReasoningBudget =
    answers.reasoning_budget?.choice || "medium";
  const requiresPlanConfidence: number =
    typeof answers.requires_plan?.noul === "number"
      ? answers.requires_plan.noul
      : 0.5;

  const requiresPlan = requiresPlanConfidence >= 0.5;

  // 3. Derive suggested starting files
  const suggestedFiles: string[] = [];
  if (args.context_files && args.context_files.length > 0) {
    suggestedFiles.push(...args.context_files.slice(0, 3));
  }

  // 4. Construct guidance for agent
  let guidance = `Reasoning tier: [${reasoningBudget}]. Complexity: [${complexity}].`;
  if (requiresPlan) {
    guidance +=
      " CRITICAL: Because of task complexity, you MUST write an implementation plan and call `evaluate_plan` before writing any code.";
  } else {
    guidance +=
      " You may proceed directly to localized edits, followed by `evaluate_code`.";
  }

  if (recommendedSkills.length > 0) {
    guidance += ` Recommended skills to activate: ${recommendedSkills
      .map((s) => s.name)
      .join(", ")}.`;
  }

  return {
    complexity,
    reasoning_budget: reasoningBudget,
    requires_plan: requiresPlan,
    recommended_skills: recommendedSkills,
    suggested_starting_files: suggestedFiles,
    guidance,
  };
}
