import { describe, it, expect } from "vitest";
import { scanSkills } from "../src/skills/scanner.js";
import * as path from "node:path";

describe("Skill Scanner", () => {
  it("should discover local workspace skills", () => {
    const cwd = path.resolve(".");
    const skills = scanSkills(cwd);
    expect(skills.length).toBeGreaterThan(0);

    const jevSkill = skills.find((s) => s.name === "jev-router");
    expect(jevSkill).toBeDefined();
    expect(jevSkill?.description).toContain("Task routing");
    expect(jevSkill?.source).toBe("workspace");
  });
});
