import { choice, noul, score } from "@typesafe-ai/sdk";

export const TASK_ASSESSMENT_QUESTIONS = {
  complexity: choice(
    "Categorize the implementation complexity of this programming task.",
    {
      trivial_fix:
        "Small typo, comment, simple single-line fix, or documentation adjustment",
      localized_logic:
        "Self-contained logic fix or isolated utility addition within a single function or component",
      refactoring:
        "Multi-file structural rework, cleaning interfaces, or extracting services without changing external behavior",
      architectural_change:
        "New subsystem, changing public APIs, core state architecture, or broad cross-cutting feature",
      database_migration:
        "Modifying database schema, table relations, persistent migrations, or data transformations",
    }
  ),
  reasoning_budget: choice(
    "What reasoning effort / thinking budget should the AI agent allocate?",
    {
      low: "Trivial or simple localized fix; minimal thinking needed",
      medium: "Standard feature or multi-function bugfix; moderate thinking needed",
      high: "Complex refactoring or cross-module changes; rigorous thinking required",
      deep: "Architectural overhaul, security-critical change, or database migration; deepest step-by-step reasoning required",
    }
  ),
  requires_plan: noul(
    "Does this task require an upfront architectural plan before modifying any code?"
  ),
};

export const PLAN_EVALUATION_QUESTIONS = {
  clarity: score(
    "Rate the clarity, specificity, and actionability of this implementation plan.",
    [
      "Ambiguous and vague with undefined steps",
      "Partially clear but missing key steps or files",
      "Adequate and functional with minor gaps",
      "Clear, concrete, and well-sequenced",
      "Exemplary, comprehensive, and perfectly structured",
    ]
  ),
  scope_complete: noul(
    "Does the plan thoroughly address all stated requirements without missing critical aspects?"
  ),
  risk_addressed: noul(
    "Does the plan adequately address edge cases, failure modes, and backwards compatibility?"
  ),
  clean_verification: noul(
    "Does the plan define concrete, actionable automated tests or manual verification steps?"
  ),
};

export const CODE_EVALUATION_QUESTIONS = {
  null_safety: noul(
    "Are null/undefined states, empty collections, optional values, and unhandled exceptions safely guarded in this diff?"
  ),
  security_integrity: noul(
    "Is the code free of security risks, injection vulnerabilities, secret leaks, and insecure data handling?"
  ),
  intent_alignment: noul(
    "Does the code diff faithfully and strictly address the stated intent without introducing unintended regressions or out-of-scope edits?"
  ),
  overall_quality: score(
    "Rate the overall code quality, maintainability, idiomatic style, and elegance of this diff.",
    [
      "Unacceptable: contains bugs, syntax errors, or regressions",
      "Below average: hard to maintain or contains anti-patterns",
      "Acceptable: functional and sound, with minor polish needed",
      "High quality: clean, idiomatic, and well-structured",
      "Flawless: production-ready, elegant, and robust",
    ]
  ),
};
