import { expect, it } from "vitest";
import {
  WorkspaceTaskSchema,
  WorkspaceAgentToolSchemas,
} from "../../packages/workspace/src/tasks.js";
import { analysisLevels } from "../../packages/workspace/src/analysis-levels.js";

it("accepts only the three human levels and keeps them out of Gabriel's tool parameters", () => {
  for (const level of Object.keys(analysisLevels))
    expect(WorkspaceTaskSchema.shape.analysis_level.parse(level)).toBe(level);
  expect(
    WorkspaceTaskSchema.shape.analysis_level.safeParse("FULL_BOARD").success,
  ).toBe(false);
  const request = {
    agent_id: "elena",
    pack_id: null,
    instruction: "Revisar",
    scope: "DOCUMENT",
    analysis_job_id: null,
  };
  expect(
    WorkspaceAgentToolSchemas.consult_specialist.safeParse({
      ...request,
      analysis_level: "PROFUNDO",
    }).success,
  ).toBe(false);
  expect(
    WorkspaceAgentToolSchemas.consult_specialist.safeParse({
      ...request,
      max_cost_usd: 3,
    }).success,
  ).toBe(false);
});
