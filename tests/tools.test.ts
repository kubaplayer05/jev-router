import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { handleAssessTask } from "../src/tools/assessTask.js";
import { handleEvaluatePlan } from "../src/tools/evaluatePlan.js";
import { handleEvaluateCode } from "../src/tools/evaluateCode.js";

describe("MCP Tools (Simulation / Mock Mode)", () => {
  const originalMock = process.env.JEV_MOCK;

  beforeAll(() => {
    process.env.JEV_MOCK = "true";
  });

  afterAll(() => {
    if (originalMock !== undefined) {
      process.env.JEV_MOCK = originalMock;
    } else {
      delete process.env.JEV_MOCK;
    }
  });
  describe("assess_task", () => {
    it("should classify a trivial styling fix with low budget and no plan", async () => {
      const result = await handleAssessTask({
        task_description: "Fix typo and styling color in button component",
      });

      expect(result.complexity).toBe("trivial_fix");
      expect(result.reasoning_budget).toBe("low");
      expect(result.requires_plan).toBe(false);
      expect(result.guidance).toBeDefined();
    });

    it("should classify an architectural overhaul with deep budget and requiring plan", async () => {
      const result = await handleAssessTask({
        task_description: "Architectural redesign of database migration and auth protocol",
      });

      expect(result.complexity).toMatch(/architectural_change|database_migration/);
      expect(result.reasoning_budget).toBe("deep");
      expect(result.requires_plan).toBe(true);
      expect(result.guidance).toContain("MUST write an implementation plan");
    });
  });

  describe("evaluate_plan", () => {
    it("should reject an extremely brief or vague plan", async () => {
      const result = await handleEvaluatePlan({
        task_description: "Refactor core billing",
        plan_markdown: "I will edit the billing file.",
      });

      expect(result.status).toBe("rejected");
      expect(result.rejection_reasons.length).toBeGreaterThan(0);
      expect(result.required_improvements.length).toBeGreaterThan(0);
    });

    it("should approve a comprehensive, structured plan", async () => {
      const detailedPlan = `
# Implementation Plan: Billing Refactor
## Proposed Changes
- Refactor \`src/billing/service.ts\` to decouple Stripe checkout logic.
- Add error boundaries for API failures and token expiration.
## Risk Management
- Backward compatibility preserved with existing webhook consumers.
- Null-safety checks added for missing subscription metadata.
## Verification Steps
- Run \`npm test\`
- Execute integration tests against Stripe mock API.
      `;

      const result = await handleEvaluatePlan({
        task_description: "Refactor billing service to isolate stripe logic and handle failure modes",
        plan_markdown: detailedPlan,
        affected_files: ["src/billing/service.ts"],
      });

      expect(result.status).toBe("approved");
      expect(result.scores.clarity).toBeGreaterThanOrEqual(3.5);
      expect(result.rejection_reasons.length).toBe(0);
    });
  });

  describe("evaluate_code", () => {
    it("should approve a clean diff without anti-patterns", async () => {
      const cleanDiff = `
diff --git a/src/math.ts b/src/math.ts
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,3 +1,5 @@
+export function safeAdd(a: number, b: number): number {
+  return (a || 0) + (b || 0);
+}
      `;

      const result = await handleEvaluateCode({
        task_intent: "Add safeAdd helper with null fallback",
        diff: cleanDiff,
        session_id: "test-clean-diff",
      });

      expect(result.status).toBe("approved");
      expect(result.actionable_fixes.length).toBe(0);
    });

    it("should reject a diff with bug smells or unhandled todos", async () => {
      const buggyDiff = `
diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,3 +10,4 @@
+const user = (req as any).user;
+// TODO: bug fix needed here, hardcoded password
+eval(req.body.code);
      `;

      const result = await handleEvaluateCode({
        task_intent: "Fix user authentication",
        diff: buggyDiff,
        session_id: "test-buggy-diff",
      });

      expect(result.status).toBe("rejected");
      expect(result.actionable_fixes.length).toBeGreaterThan(0);
    });

    it("should escalate when retry limit (5) is exceeded", async () => {
      const buggyDiff = `const bad = "eval(code)"; // TODO: bug`;
      const sessionId = "escalation-test-session";

      let lastResult;
      for (let i = 1; i <= 6; i++) {
        lastResult = await handleEvaluateCode({
          task_intent: "Refactor core",
          diff: buggyDiff,
          session_id: sessionId,
        });
      }

      expect(lastResult?.status).toBe("escalated");
      expect(lastResult?.attempt).toBe(6);
      expect(lastResult?.actionable_fixes[0]).toContain("ESCALATION");
    }, 15000);
  });
});
