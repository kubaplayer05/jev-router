import { z } from "zod";
import { jevEngine } from "../jev/client.js";
import { PLAN_EVALUATION_QUESTIONS } from "../jev/rubrics.js";
import { loadConfig } from "../config.js";
import { resolveWorkingDirectory } from "../utils/workspace.js";
import { PlanEvaluationResult } from "../types.js";
import { logger } from "../utils/logger.js";

export const evaluatePlanSchema = {
  task_description: z
    .string()
    .describe("The original task intent or user requirements"),
  plan_markdown: z
    .string()
    .describe("The complete implementation plan in markdown format"),
  affected_files: z
    .array(z.string())
    .optional()
    .describe("Files the plan proposes to modify, delete, or create"),
  working_directory: z
    .string()
    .optional()
    .describe("Working directory to resolve project configuration"),
};

export async function handleEvaluatePlan(args: {
  task_description: string;
  plan_markdown: string;
  affected_files?: string[];
  working_directory?: string;
}): Promise<PlanEvaluationResult> {
  const cwd = resolveWorkingDirectory(args.working_directory);
  const config = loadConfig(cwd);

  logger.info(
    `Evaluating plan for task: "${args.task_description.slice(0, 60)}..." (length: ${
      args.plan_markdown.length
    } chars)`
  );

  const statePayload = [
    `Task Intent: ${args.task_description}`,
    `Proposed Affected Files: ${(args.affected_files || []).join(", ") || "None specified"}`,
    "--- Plan Content ---",
    args.plan_markdown,
  ].join("\n");

  const evaluationResult = await jevEngine.evaluate({
    state: statePayload,
    questions: PLAN_EVALUATION_QUESTIONS,
  });

  const answers = evaluationResult.answers as any;

  const clarityScore = typeof answers.clarity?.score === "number" ? answers.clarity.score : 3.0;
  const scopeComplete = typeof answers.scope_complete?.noul === "number" ? answers.scope_complete.noul : 0.5;
  const riskAddressed = typeof answers.risk_addressed?.noul === "number" ? answers.risk_addressed.noul : 0.5;
  const cleanVerification = typeof answers.clean_verification?.noul === "number" ? answers.clean_verification.noul : 0.5;

  const rejectionReasons: string[] = [];
  const requiredImprovements: string[] = [];

  const minClarity = config.thresholds.min_plan_clarity;
  const minConfidence = config.thresholds.min_safety_confidence;

  if (clarityScore < minClarity) {
    rejectionReasons.push(
      `Plan clarity scored ${clarityScore.toFixed(1)}/5.0 (below minimum threshold of ${minClarity.toFixed(1)}). The steps are too vague or lack concrete details.`
    );
    requiredImprovements.push(
      "Detail specific code changes, method names, and architectural decisions step-by-step."
    );
  }

  if (scopeComplete < minConfidence) {
    rejectionReasons.push(
      `Scope completeness confidence is ${(scopeComplete * 100).toFixed(0)}% (threshold: ${(minConfidence * 100).toFixed(0)}%). Key task requirements appear to be omitted.`
    );
    requiredImprovements.push(
      "Ensure all user requirements and expected outcomes are directly mapped to actions in the plan."
    );
  }

  if (riskAddressed < minConfidence) {
    rejectionReasons.push(
      `Risk and edge case coverage is ${(riskAddressed * 100).toFixed(0)}% (threshold: ${(minConfidence * 100).toFixed(0)}%). Edge cases or failure modes are not accounted for.`
    );
    requiredImprovements.push(
      "Add explicit mitigation for failure cases, missing inputs, and backwards compatibility."
    );
  }

  if (cleanVerification < minConfidence) {
    rejectionReasons.push(
      `Verification plan confidence is ${(cleanVerification * 100).toFixed(0)}% (threshold: ${(minConfidence * 100).toFixed(0)}%). Test steps are missing or imprecise.`
    );
    requiredImprovements.push(
      "Include concrete commands or automated tests to verify your changes once implemented."
    );
  }

  const isApproved = rejectionReasons.length === 0;

  return {
    status: isApproved ? "approved" : "rejected",
    scores: {
      clarity: Number(clarityScore.toFixed(2)),
      scope_complete: Number(scopeComplete.toFixed(2)),
      risk_addressed: Number(riskAddressed.toFixed(2)),
      clean_verification: Number(cleanVerification.toFixed(2)),
    },
    rejection_reasons: rejectionReasons,
    required_improvements: requiredImprovements,
  };
}
