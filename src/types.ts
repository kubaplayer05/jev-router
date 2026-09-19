import { z } from "zod";

/**
 * Task complexity categories for routing
 */
export const ComplexityTierSchema = z.enum([
  "trivial_fix",
  "localized_logic",
  "refactoring",
  "architectural_change",
  "database_migration",
]);
export type ComplexityTier = z.infer<typeof ComplexityTierSchema>;

/**
 * Reasoning budget recommendation
 */
export const ReasoningBudgetSchema = z.enum(["low", "medium", "high", "deep"]);
export type ReasoningBudget = z.infer<typeof ReasoningBudgetSchema>;

/**
 * Discovered skill metadata
 */
export interface InstalledSkill {
  name: string;
  description: string;
  filePath: string;
  source: "workspace" | "global" | "custom";
}

/**
 * Skill recommendation output
 */
export interface SkillRecommendation {
  name: string;
  description: string;
  relevance: number;
  reason: string;
}

/**
 * Output of assess_task
 */
export interface TaskAssessmentResult {
  complexity: ComplexityTier;
  reasoning_budget: ReasoningBudget;
  requires_plan: boolean;
  recommended_skills: SkillRecommendation[];
  suggested_starting_files: string[];
  guidance: string;
}

/**
 * Output of evaluate_plan
 */
export interface PlanEvaluationResult {
  status: "approved" | "rejected";
  scores: {
    clarity: number;
    scope_complete: number;
    risk_addressed: number;
    clean_verification: number;
  };
  rejection_reasons: string[];
  required_improvements: string[];
}

/**
 * Deterministic check result
 */
export interface DeterministicCheckResult {
  passed: boolean;
  command: string;
  stack: string;
  output?: string;
  durationMs?: number;
}

/**
 * Code evaluation rubric dimensions
 */
export interface CodeRubricResult {
  null_safety: { passed: boolean; confidence: number };
  security_integrity: { passed: boolean; confidence: number };
  intent_alignment: { passed: boolean; confidence: number };
  overall_quality: number;
}

/**
 * Output of evaluate_code
 */
export interface CodeEvaluationResult {
  status: "approved" | "rejected" | "escalated";
  attempt: number;
  max_retries: number;
  deterministic_check?: DeterministicCheckResult;
  rubric: CodeRubricResult;
  actionable_fixes: string[];
}

/**
 * Project configuration schema
 */
export interface JevRouterConfig {
  max_retries: number;
  thresholds: {
    min_code_quality: number;
    min_plan_clarity: number;
    min_safety_confidence: number;
  };
  deterministic_checks: {
    enabled: boolean;
    custom_command?: string;
    timeout_ms: number;
  };
  skills: {
    extra_paths: string[];
  };
}
