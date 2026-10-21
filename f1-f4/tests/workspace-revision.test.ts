import { expect, it } from "vitest";
import { workspaceFailure } from "../../packages/workspace/src/revision-intent.js";
import {
  WorkspaceAnswerSchema,
  WorkspaceDirectorSchema,
  validTeamPlan,
} from "../../packages/workspace/src/tasks.js";
it("allows the director to continue work without inventing a new team", () => {
  const plan = WorkspaceDirectorSchema.parse({
    kind: "CONTINUE",
    reply: "Preparo la versión con las decisiones guardadas.",
    lead_id: null,
    participants: [],
    missing_inputs: [],
    continuation: {
      action: "REWRITE",
      agent_id: "valeria",
      analysis_job_id: null,
      scope: "DOCUMENT",
      instruction: "Preparar la versión negociada conservando las condiciones.",
    },
  });
  expect(validTeamPlan(plan)).toBe(true);
  expect(validTeamPlan({ ...plan, continuation: null })).toBe(false);
  expect(validTeamPlan({ ...plan, kind: "DIRECT" })).toBe(false);
});
it("accepts a full contract beyond the former 20000-character cap, retaining a bounded output", () => {
  const data = {
    summary: "Propuesta",
    findings: [],
    replacement_text: "X".repeat(21342),
    references: [],
    limitations: [],
  };
  expect(WorkspaceAnswerSchema.parse(data).replacement_text).toHaveLength(
    21342,
  );
  expect(
    WorkspaceAnswerSchema.safeParse({
      ...data,
      replacement_text: "X".repeat(60001),
    }).success,
  ).toBe(false);
  expect(workspaceFailure("WORKSPACE_OPERATION_FAILED")).toContain(
    "se interrumpió",
  );
});
