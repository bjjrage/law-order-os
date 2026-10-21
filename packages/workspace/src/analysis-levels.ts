/** Human-selected execution profile. Every profile uses the same legal controls. */
export const analysisLevels = {
  AGIL: {
    label: "Ágil",
    model: "deepseek-flash",
    provider: "deepseek",
    effort: "low",
  },
  MEDIO: {
    label: "Medio",
    model: "deepseek-flash",
    provider: "deepseek",
    effort: "high",
  },
  PROFUNDO: {
    label: "Profundo",
    model: "gpt-6.1-sol",
    provider: "openai",
    effort: "xhigh",
  },
} as const;
export type AnalysisLevel = keyof typeof analysisLevels;
export const defaultAnalysisLevel: AnalysisLevel = "MEDIO";
export function isAnalysisLevel(value: unknown): value is AnalysisLevel {
  return typeof value === "string" && Object.hasOwn(analysisLevels, value);
}
