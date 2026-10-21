import {
  analysisLevels,
  defaultAnalysisLevel,
  isAnalysisLevel,
} from "../packages/workspace/src/analysis-levels.ts";

/** The human selects a profile; Gabriel selects specialties, never the model. */
export function workspaceModels(env, level = defaultAnalysisLevel) {
  if (!isAnalysisLevel(level)) throw Error("WORKSPACE_ANALYSIS_LEVEL_INVALID");
  const selected = analysisLevels[level];
  const effort = env.GABRIEL_REASONING_EFFORT || "xhigh";
  if (!["low", "medium", "high", "xhigh", "max"].includes(effort))
    throw Error("GABRIEL_REASONING_EFFORT_INVALID");
  const model =
    selected.provider === "deepseek"
      ? env.DEEPSEEK_ANALYSIS_MODEL || selected.model
      : env.OPENAI_SOL_MODEL || selected.model;
  if (model !== selected.model) throw Error("WORKSPACE_ANALYSIS_MODEL_INVALID");
  const auditorModel = env.GEMINI_AUDITOR_MODEL || "gemini-3.8-flash";
  if (auditorModel !== "gemini-3.8-flash" || auditorModel === model)
    throw Error("WORKSPACE_INDEPENDENT_AUDITOR_REQUIRED");
  return {
    director: {
      provider: "openai",
      model: env.OPENAI_LUNA_MODEL,
      key: env.OPENAI_API_KEY,
      effort,
    },
    analysis: {
      provider: selected.provider,
      model,
      key:
        selected.provider === "deepseek"
          ? env.DEEPSEEK_API_KEY
          : env.OPENAI_API_KEY,
      effort: selected.effort,
    },
    auditor: {
      provider: "google",
      model: auditorModel,
      key: env.GEMINI_API_KEY,
    },
    auditorFallback: {
      provider: "openai",
      model: env.OPENAI_LUNA_MODEL,
      key: env.OPENAI_API_KEY,
      effort: "xhigh",
    },
  };
}
