import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assessTaskSchema, handleAssessTask } from "./tools/assessTask.js";
import { evaluatePlanSchema, handleEvaluatePlan } from "./tools/evaluatePlan.js";
import { evaluateCodeSchema, handleEvaluateCode } from "./tools/evaluateCode.js";
import { listSkillsSchema, handleListSkills } from "./tools/listSkills.js";
import { logger } from "./utils/logger.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "jev-router",
    version: "0.1.0",
  });

  // 1. Tool: assess_task
  server.tool(
    "assess_task",
    "Analyzes task complexity, prescribes reasoning budget (low/medium/high/deep), suggests starting files, and maps installed skills before any code is modified.",
    assessTaskSchema,
    async (args) => {
      try {
        const result = await handleAssessTask(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        logger.error(`Error in assess_task: ${String(err)}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: String(err) }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 2. Tool: evaluate_plan
  server.tool(
    "evaluate_plan",
    "Evaluates an implementation plan created by an AI agent before code modifications begin. Checks clarity, scope completeness, edge case/risk coverage, and verification steps.",
    evaluatePlanSchema,
    async (args) => {
      try {
        const result = await handleEvaluatePlan(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        logger.error(`Error in evaluate_plan: ${String(err)}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: String(err) }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 3. Tool: evaluate_code
  server.tool(
    "evaluate_code",
    "Evaluates code diffs using multi-language deterministic pre-flight checks (lint/typecheck) followed by Jev System One semantic rubric scoring (null-safety, security, intent alignment, quality score). Enforces retry gating and automatic escalation (max 5 retries).",
    evaluateCodeSchema,
    async (args) => {
      try {
        const result = await handleEvaluateCode(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        logger.error(`Error in evaluate_code: ${String(err)}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: String(err) }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 4. Tool: list_skills
  server.tool(
    "list_skills",
    "Discovers and lists all installed agent skills across workspace and user-global directories.",
    listSkillsSchema,
    async (args) => {
      try {
        const result = await handleListSkills(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        logger.error(`Error in list_skills: ${String(err)}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: String(err) }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
