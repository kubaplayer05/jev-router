import "../utils/env.js";
import {
  TypeSafeClient,
  type SystemOneRequest,
  type SystemOneResult,
  type Questions,
} from "@typesafe-ai/sdk";
import { logger } from "../utils/logger.js";

export class JevEngine {
  private client: TypeSafeClient | null = null;
  private isMock: boolean = false;

  constructor() {
    const apiKey = process.env.TYPESAFE_API_KEY;
    const forceMock = process.env.JEV_MOCK === "true";

    if (forceMock || !apiKey) {
      this.isMock = true;
      if (!apiKey) {
        logger.info(
          "TYPESAFE_API_KEY not found in environment. Initializing JevEngine in Mock Simulation Mode."
        );
      } else {
        logger.info("JEV_MOCK=true set. Running JevEngine in Mock Simulation Mode.");
      }
    } else {
      try {
        this.client = new TypeSafeClient({ apiKey });
        logger.info("Connected to TypeSafe Jev AI API (Live Mode).");
      } catch (err) {
        logger.warn(
          `Failed to initialize TypeSafeClient (${String(err)}). Falling back to Mock Simulation Mode.`
        );
        this.isMock = true;
      }
    }
  }

  public isMockMode(): boolean {
    return this.isMock || process.env.JEV_MOCK === "true";
  }

  public async evaluate<const Q extends Questions>(
    request: SystemOneRequest<Q>
  ): Promise<SystemOneResult<Q>> {
    if (!this.isMockMode() && this.client) {
      try {
        const start = Date.now();
        const result = await this.client.systemOne(request);
        const duration = Date.now() - start;
        logger.debug(`Jev SystemOne call completed in ${duration}ms`);
        return result;
      } catch (err) {
        logger.error(`Live Jev API call failed: ${String(err)}. Falling back to mock evaluator.`);
      }
    }

    // Mock Evaluator
    return this.mockSystemOne(request);
  }

  private mockSystemOne<const Q extends Questions>(
    request: SystemOneRequest<Q>
  ): SystemOneResult<Q> {
    const state = typeof request.state === "string" ? request.state.toLowerCase() : "";
    const questionKeys = Object.keys(request.questions);
    const mockAnswers: Record<string, any> = {};

    for (const key of questionKeys) {
      const q = request.questions[key] as any;
      if (!q) continue;

      if (q.type === "choice") {
        if (key === "complexity") {
          if (state.includes("migrate") || state.includes("database") || state.includes("schema") || state.includes("table")) {
            mockAnswers[key] = { choice: "database_migration" };
          } else if (state.includes("architect") || state.includes("redesign") || state.includes("protocol") || state.includes("auth")) {
            mockAnswers[key] = { choice: "architectural_change" };
          } else if (state.includes("refactor") || state.includes("extract") || state.includes("rework")) {
            mockAnswers[key] = { choice: "refactoring" };
          } else if (state.includes("typo") || state.includes("style") || state.includes("color") || state.includes("comment")) {
            mockAnswers[key] = { choice: "trivial_fix" };
          } else {
            mockAnswers[key] = { choice: "localized_logic" };
          }
        } else if (key === "reasoning_budget") {
          if (state.includes("architect") || state.includes("migrate") || state.includes("redesign")) {
            mockAnswers[key] = { choice: "deep" };
          } else if (state.includes("refactor") || state.includes("security")) {
            mockAnswers[key] = { choice: "high" };
          } else if (state.includes("typo") || state.includes("comment")) {
            mockAnswers[key] = { choice: "low" };
          } else {
            mockAnswers[key] = { choice: "medium" };
          }
        } else {
          // generic fallback to first option
          const firstKey = Object.keys(q.criteria ?? {})[0] ?? "default";
          mockAnswers[key] = { choice: firstKey };
        }
      } else if (q.type === "score") {
        if (key === "clarity") {
          // Higher score if plan is detailed
          const len = state.length;
          mockAnswers[key] = { score: len > 300 ? 4.3 : len > 100 ? 3.6 : 2.1 };
        } else if (key === "overall_quality") {
          // Detect bad code smells in diff
          if (state.includes("todo:") || state.includes("bug") || state.includes("as any") || state.includes("console.log")) {
            mockAnswers[key] = { score: 3.2 };
          } else {
            mockAnswers[key] = { score: 4.5 };
          }
        } else {
          mockAnswers[key] = { score: 4.0 };
        }
      } else if (q.type === "noul") {
        if (key === "requires_plan") {
          const isComplex = state.includes("architect") || state.includes("migrate") || state.includes("refactor") || state.includes("redesign");
          mockAnswers[key] = { noul: isComplex ? 0.92 : 0.25 };
        } else if (key === "null_safety") {
          const hasNullRisk = state.includes("!") || state.includes("null") || state.includes("undefined");
          mockAnswers[key] = { noul: hasNullRisk ? 0.88 : 0.96 };
        } else if (key === "security_integrity") {
          const hasSecurityRisk = state.includes("eval(") || state.includes("dangerously") || state.includes("password") || state.includes("token");
          mockAnswers[key] = { noul: hasSecurityRisk ? 0.45 : 0.99 };
        } else if (key === "intent_alignment") {
          mockAnswers[key] = { noul: 0.94 };
        } else if (key === "scope_complete" || key === "risk_addressed" || key === "clean_verification") {
          mockAnswers[key] = { noul: state.length > 200 ? 0.91 : 0.65 };
        } else {
          // skill matching: check if skill name or description appears in prompt
          const promptLower = q.instructions?.toLowerCase?.() ?? "";
          const isMatch = promptLower.split(" ").some((w: string) => w.length > 3 && state.includes(w));
          mockAnswers[key] = { noul: isMatch ? 0.88 : 0.2 };
        }
      }
    }

    return { answers: mockAnswers } as unknown as SystemOneResult<Q>;
  }
}

export const jevEngine = new JevEngine();
