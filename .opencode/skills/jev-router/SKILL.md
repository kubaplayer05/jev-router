---
name: jev-router
description: Task routing, reasoning budget allocation, skill mapping, and code quality evaluation gate powered by Jev AI.
---

# Jev-Router Quality Protocol

You are connected to **jev-router**, an intelligent MCP supervisor and evaluation gate powered by Jev AI System One decision primitives.

You MUST adhere to the following 3-phase quality protocol for any coding request.

---

## Phase 1: Task Assessment & Routing (Mandatory First Step)

**Before opening files, making assumptions, or writing code:**
1. Call the `assess_task` tool with:
   - `task_description`: The user's prompt or instruction.
   - `context_files`: Any files mentioned or currently open.
   - `working_directory`: The current project root.
2. Read the returned assessment:
   - **Reasoning Budget**: Adjust your internal thinking effort (`low`, `medium`, `high`, `deep`) as prescribed by the tool.
   - **Recommended Skills**: If any skills are recommended, immediately load and follow their specific workflow instructions.
   - **Starting Files**: Prioritize inspecting the suggested files first.
   - **Requires Plan**: Check if an upfront implementation plan is required.

---

## Phase 2: Plan Evaluation Gate (If `requires_plan` is true)

If `assess_task` returned `requires_plan: true` or if the task complexity is `refactoring`, `architectural_change`, or `database_migration`:

1. **Draft your plan**: Structure your implementation plan covering:
   - Problem summary and proposed architectural changes
   - Specific files to create, modify, or delete
   - Risk management, edge cases, and backward compatibility
   - Concrete automated verification steps
2. **Call `evaluate_plan`** with:
   - `task_description`: The original task requirements.
   - `plan_markdown`: Your complete plan.
   - `affected_files`: List of files you intend to touch.
3. **Handle Plan Evaluation Result**:
   - **If `status: "approved"`**: Proceed to implementation.
   - **If `status: "rejected"`**: You MUST NOT start coding. Address each item in `rejection_reasons` and `required_improvements`, update your plan, and re-call `evaluate_plan` until approved.

---

## Phase 3: Code Evaluation Gate (Mandatory After Making Edits)

**After modifying files, before presenting your work or declaring completion to the user:**

1. **Call `evaluate_code`** with:
   - `task_intent`: Brief description of what your changes accomplished.
   - `diff`: The git diff or summary of changed code.
   - `working_directory`: The project root (enables deterministic compilation/lint pre-checks).
   - `session_id`: (Optional) Consistent ID or task hash to track attempts.
2. **Handle Code Evaluation Result**:
   - **If `status: "approved"`**: The changes passed both deterministic pre-checks and Jev semantic rubrics. You may now present your solution to the user.
   - **If `status: "rejected"`**:
     - Do NOT ask the user to test broken code.
     - Carefully review `actionable_fixes` (which may include compiler errors, missing null guards, security concerns, or out-of-scope regressions).
     - Fix the reported issues in your code.
     - Call `evaluate_code` again with the updated diff.
   - **If `status: "escalated"`**:
     - The maximum retry limit (5 retries) has been reached.
     - Stop automated retries immediately to avoid wasting tokens.
     - Clearly explain the remaining blockers to the human user and ask for guidance.
