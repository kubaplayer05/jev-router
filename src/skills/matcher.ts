import { noul } from "@typesafe-ai/sdk";
import { InstalledSkill, SkillRecommendation } from "../types.js";
import { jevEngine } from "../jev/client.js";
import { logger } from "../utils/logger.js";

export async function matchSkillsForTask(
  taskDescription: string,
  installedSkills: InstalledSkill[]
): Promise<SkillRecommendation[]> {
  if (installedSkills.length === 0) {
    return [];
  }

  // To avoid exceeding Jev question limits if there are dozens of skills,
  // we take up to 20 discovered skills
  const candidateSkills = installedSkills.slice(0, 20);
  const questions: Record<string, any> = {};

  candidateSkills.forEach((skill, idx) => {
    questions[`skill_${idx}`] = noul(
      `Is the skill '${skill.name}' (${skill.description}) relevant and helpful for this task?`
    );
  });

  try {
    const result = await jevEngine.evaluate({
      state: taskDescription,
      questions,
    });

    const recommendations: SkillRecommendation[] = [];

    candidateSkills.forEach((skill, idx) => {
      const ans = result.answers[`skill_${idx}`] as any;
      const confidence = typeof ans?.noul === "number" ? ans.noul : 0;

      if (confidence >= 0.65) {
        recommendations.push({
          name: skill.name,
          description: skill.description,
          relevance: Number(confidence.toFixed(2)),
          reason: `Evaluated as highly relevant (${(confidence * 100).toFixed(0)}% confidence) to the task intent.`,
        });
      }
    });

    // Sort by relevance descending
    recommendations.sort((a, b) => b.relevance - a.relevance);
    return recommendations;
  } catch (err) {
    logger.warn(`Failed to match skills using Jev: ${String(err)}`);
    return [];
  }
}
