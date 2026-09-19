import { z } from "zod";
import { jevEngine } from "../jev/client.js";
import { CODE_EVALUATION_QUESTIONS } from "../jev/rubrics.js";
import { runPreCheck } from "../prechecks/runner.js";
import { retryManager } from "../session/retryManager.js";
import { loadConfig } from "../config.js";
import { resolveWorkingDirectory } from "../utils/workspace.js";
import { CodeEvaluationResult, CodeRubricResult } from "../types.js";
import { logger } from "../utils/logger.js";

export const evaluateCodeSchema = {
  task_intent: z
    .string()
    .describe("What the code modifications are intended to accomplish"),
  diff: z
    .string()
    .describe("Unified git diff or changed code block to evaluate"),
  working_directory: z
    .string()
    .optional()
    .describe("Root directory of the project for running pre-checks and reading config"),
  session_id: z
    .string()
    .optional()
    .describe("Optional session or task identifier to track attempt counts across retries"),
};

export async function handleEvaluateCode(args: {
  task_intent: string;
  diff: string;
  working_directory?: string;
  session_id?: string;
}): Promise<CodeEvaluationResult> {
  const cwd = resolveWorkingDirectory(args.working_directory);
  const config = loadConfig(cwd);

  const sessionKey = retryManager.getSessionKey(args.session_id, args.task_intent);
  const { attempt, maxRetries, isExceeded } = retryManager.recordAttempt(
    sessionKey,
    config.max_retries
  );

  logger.info(
    `Evaluating code for session [${sessionKey}] (Attempt ${attempt}/${maxRetries}): "${args.task_intent.slice(
      0,
      60
    )}..."`
  );

  // 1. Phase A: Deterministic Multi-Language Pre-Check (<200ms)
  const preCheckResult = await runPreCheck(cwd, config);

  if (preCheckResult && !preCheckResult.passed) {
    logger.warn(`Deterministic pre-check failed on attempt ${attempt}. Instant rejection.`);
    const status = isExceeded ? "escalated" : "rejected";
    const actionableFixes = [
      `Deterministic pre-check command failed: \`${preCheckResult.command}\``,
      preCheckResult.output || "Compiler/linter returned an error with no output.",
    ];

    if (isExceeded) {
      actionableFixes.unshift(
        `ESCALATION: Maximum retry threshold (${maxRetries}) reached. Halting automatic retries and escalating to user.`
      );
    }

    return {
      status,
      attempt,
      max_retries: maxRetries,
      deterministic_check: preCheckResult,
      rubric: {
        null_safety: { passed: false, confidence: 0 },
        security_integrity: { passed: false, confidence: 0 },
        intent_alignment: { passed: false, confidence: 0 },
        overall_quality: 1.0,
      },
      actionable_fixes: actionableFixes,
    };
  }

  // 2. Phase B: Semantic Jev Rubric Evaluation
  const statePayload = [
    `Stated Intent: ${args.task_intent}`,
    "--- Unified Diff / Proposed Changes ---",
    args.diff,
  ].join("\n");

  const evaluationResult = await jevEngine.evaluate({
    state: statePayload,
    questions: CODE_EVALUATION_QUESTIONS,
  });

  const answers = evaluationResult.answers as any;

  const nullSafetyConf =
    typeof answers.null_safety?.noul === "number"
      ? answers.null_safety.noul
      : 0.5;
  const securityConf =
    typeof answers.security_integrity?.noul === "number"
      ? answers.security_integrity.noul
      : 0.5;
  const intentConf =
    typeof answers.intent_alignment?.noul === "number"
      ? answers.intent_alignment.noul
      : 0.5;
  const qualityScore =
    typeof answers.overall_quality?.score === "number"
      ? answers.overall_quality.score
      : 3.0;

  const minQuality = config.thresholds.min_code_quality;
  const minConfidence = config.thresholds.min_safety_confidence;

  const actionableFixes: string[] = [];

  const rubricResult: CodeRubricResult = {
    null_safety: {
      passed: nullSafetyConf >= minConfidence,
      confidence: Number(nullSafetyConf.toFixed(2)),
    },
    security_integrity: {
      passed: securityConf >= minConfidence,
      confidence: Number(securityConf.toFixed(2)),
    },
    intent_alignment: {
      passed: intentConf >= minConfidence,
      confidence: Number(intentConf.toFixed(2)),
    },
    overall_quality: Number(qualityScore.toFixed(2)),
  };

  if (!rubricResult.null_safety.passed) {
    actionableFixes.push(
      `Null/Undefined safety confidence is ${(nullSafetyConf * 100).toFixed(
        0
      )}% (minimum: ${(minConfidence * 100).toFixed(
        0
      )}%). Guard against undefined properties, null references, or unhandled exceptions.`
    );
  }

  if (!rubricResult.security_integrity.passed) {
    actionableFixes.push(
      `Security confidence is ${(securityConf * 100).toFixed(
        0
      )}% (minimum: ${(minConfidence * 100).toFixed(
        0
      )}%). Address potential injection risks, hardcoded credentials, or insecure patterns.`
    );
  }

  if (!rubricResult.intent_alignment.passed) {
    actionableFixes.push(
      `Intent alignment confidence is ${(intentConf * 100).toFixed(
        0
      )}% (minimum: ${(minConfidence * 100).toFixed(
        0
      )}%). Diff appears to diverge from the original task intent or introduce unintended modifications.`
    );
  }

  if (qualityScore < minQuality) {
    actionableFixes.push(
      `Overall code quality scored ${qualityScore.toFixed(
        1
      )}/5.0 (minimum: ${minQuality.toFixed(
        1
      )}). Refactor the changes to follow clean, idiomatic patterns and clean up leftover debug statements or anti-patterns.`
    );
  }

  const isApproved = actionableFixes.length === 0;

  if (isApproved) {
    retryManager.resetSession(sessionKey);
    return {
      status: "approved",
      attempt,
      max_retries: maxRetries,
      deterministic_check: preCheckResult,
      rubric: rubricResult,
      actionable_fixes: [],
    };
  }

  // Handle rejection or escalation
  const status = isExceeded ? "escalated" : "rejected";

  if (isExceeded) {
    actionableFixes.unshift(
      `ESCALATION: Maximum retry threshold (${maxRetries}) reached for this task. Agent must halt automated retries and request user input.`
    );
  }

  return {
    status,
    attempt,
    max_retries: maxRetries,
    deterministic_check: preCheckResult,
    rubric: rubricResult,
    actionable_fixes: actionableFixes,
  };
}
