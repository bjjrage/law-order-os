import { expect, it, vi } from "vitest";
import { z } from "zod";
import { DeepSeekProvider, GeminiLiveProvider } from "../../junta-juridica/src/providers/live.js";
// @ts-expect-error Native host configuration.
import { workspaceModels } from "../../scripts/workspace-models.mjs";
// @ts-expect-error Native host auditor policy.
import { auditWithFallback } from "../../scripts/workspace-auditor.mjs";

it.each([
  ["AGIL", "deepseek-flash", "low"],
  ["MEDIO", "deepseek-flash", "high"],
  ["PROFUNDO", "gpt-6.1-sol", "xhigh"],
])("resolves %s through the same director and independent auditor", (level, model, effort) => {
  const models = workspaceModels({ OPENAI_LUNA_MODEL: "gpt-6-luna", OPENAI_API_KEY: "openai-only", DEEPSEEK_API_KEY: "deepseek-only" }, level);
  expect(models.director).toMatchObject({ model: "gpt-6-luna", key: "openai-only", effort: "xhigh" });
  expect(models.analysis).toMatchObject({ model, effort, key: model === "deepseek-flash" ? "deepseek-only" : "openai-only" });
  expect(models.auditor.model).toBe("gemini-3.8-flash");
  expect(models.auditor.model).not.toBe(models.analysis.model);
  expect(models.auditorFallback).toMatchObject({ model: "gpt-6-luna", effort: "xhigh" });
  expect(models.auditorFallback.model).not.toBe(models.analysis.model);
});
it("refuses unknown profiles and substituted models rather than silently switching authors", () => {
  expect(() => workspaceModels({}, "FULL_BOARD")).toThrow("WORKSPACE_ANALYSIS_LEVEL_INVALID");
  expect(() => workspaceModels({ DEEPSEEK_ANALYSIS_MODEL: "other" })).toThrow("WORKSPACE_ANALYSIS_MODEL_INVALID");
  expect(() => workspaceModels({ OPENAI_SOL_MODEL: "other" }, "PROFUNDO")).toThrow("WORKSPACE_ANALYSIS_MODEL_INVALID");
  expect(() => workspaceModels({ GEMINI_AUDITOR_MODEL: "deepseek-flash" })).toThrow("WORKSPACE_INDEPENDENT_AUDITOR_REQUIRED");
});

const fallbackModels = workspaceModels({ OPENAI_LUNA_MODEL: 'gpt-6-luna', WORKSPACE_ANALYSIS_PROVIDER: 'deepseek' });
it.each(['MISSING_GEMINI_AUDITOR_CREDENTIAL', 'PROVIDER_HTTP_429', 'PROVIDER_HTTP_503', 'PROVIDER_ABORTED', 'TRANSPORT_OUTCOME_UNKNOWN', 'INVALID_MODEL_OUTPUT'])("uses one independent Luna fallback after %s", async (reason) => {
  const invoke = vi.fn().mockRejectedValueOnce(Error(reason)).mockResolvedValueOnce({ outcome: 'INSUFFICIENT_EVIDENCE' });
  const result = await auditWithFallback(fallbackModels, invoke);
  expect(invoke.mock.calls.map(([role]) => role)).toEqual(['auditor', 'auditorFallback']);
  expect(result.metadata).toEqual({ model_id: 'gpt-6-luna', reasoning_effort: 'xhigh', fallback_from: 'gemini-3.8-flash', fallback_reason: reason });
});
it.each(['BUDGET_EXHAUSTED', 'CURRENT_PRICE_REQUIRED', 'UNEXPECTED_MODEL_ID', 'MODEL_REFUSAL', 'INCOMPLETE_AUDIT_RESPONSE', 'WORKSPACE_INDEPENDENT_AUDITOR_REQUIRED'])("does not bypass %s through fallback", async (reason) => {
  const invoke = vi.fn().mockRejectedValue(Error(reason));
  await expect(auditWithFallback(fallbackModels, invoke)).rejects.toThrow(reason);
  expect(invoke).toHaveBeenCalledTimes(1);
});
it('never switches auditors because of adverse findings and never loops after fallback failure', async () => {
  const adverse = vi.fn().mockResolvedValue({ outcome: 'CHANGES_REQUIRED' });
  expect((await auditWithFallback(fallbackModels, adverse)).metadata.model_id).toBe('gemini-3.8-flash');
  expect(adverse).toHaveBeenCalledTimes(1);
  const failed = vi.fn().mockRejectedValueOnce(Error('PROVIDER_HTTP_503')).mockRejectedValueOnce(Error('PROVIDER_HTTP_429'));
  await expect(auditWithFallback(fallbackModels, failed)).rejects.toThrow('PROVIDER_HTTP_429');
  expect(failed).toHaveBeenCalledTimes(2);
});
it('rejects the fallback when Luna produced the analysis', async () => {
  const invoke = vi.fn().mockRejectedValue(Error('PROVIDER_HTTP_503'));
  await expect(auditWithFallback({ ...fallbackModels, analysis: { model: 'gpt-6-luna' } }, invoke)).rejects.toThrow('WORKSPACE_INDEPENDENT_AUDITOR_REQUIRED');
  expect(invoke).toHaveBeenCalledTimes(1);
});

const schema = z.object({ summary: z.string() });
const response = (value: unknown) => new Response(JSON.stringify(value));
it("uses Gemini's workspace audit schema, original evidence and token counting with Google credentials only", async () => {
  const transport = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response({ totalTokens: 120 }))
    .mockResolvedValueOnce(response({ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1000000, outputTokenLimit: 64000 }))
    .mockResolvedValueOnce(response({ modelVersion: 'gemini-3.8-flash', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"summary":"Objeción de prueba"}' }] } }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80, thoughtsTokenCount: 20 } }));
  const provider = new GeminiLiveProvider<{ originals: string; author_output: string }, { summary: string }>('gemini-3.8-flash', 'google-only', 100000, 8000, transport, false, { schema, instructions: 'Revisá los originales y cuestioná las conclusiones.' });
  const call = provider.prepare({ originals: 'Texto ficticio original', author_output: 'Interpretación a revisar' });
  expect(await provider.countInputTokens(call, new AbortController().signal)).toBe(120);
  await provider.verifyAvailability(new AbortController().signal);
  const result = await provider.invoke(call, new AbortController().signal);
  expect(result.output.summary).toBe('Objeción de prueba');
  expect(result.usage.output_tokens).toBe(100);
  for (const [, options] of transport.mock.calls) {
    expect((options?.headers as Record<string,string>)['x-goog-api-key']).toBe('google-only');
    expect((options?.headers as Record<string,string>).Authorization).toBeUndefined();
  }
  const body = JSON.parse(transport.mock.calls[2]![1]!.body as string);
  expect(body.generationConfig.responseJsonSchema.properties.summary.type).toBe('string');
  expect(body.contents[0].parts[0].text).toContain('Texto ficticio original');
  expect(body.systemInstruction.parts[0].text).toContain('cuestioná las conclusiones');
});
it("validates DeepSeek access, JSON schema, model and usage without an OpenAI token-count request", async () => {
  const transport = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response({ data: [{ id: "deepseek-flash" }] }))
    .mockResolvedValueOnce(response({ model: "deepseek-flash", status: "completed", output: [{ content: [{ type: "output_text", text: '{"summary":"Prueba sintética"}' }] }], usage: { input_tokens: 500, output_tokens: 800, output_tokens_details: { reasoning_tokens: 600 } } }));
  const provider = new DeepSeekProvider("deepseek-flash", "fake-key", schema, "Devolvé JSON", "high", 1000000, 16000, transport);
  const call = provider.prepare({ text: "Texto ficticio" });
  expect(await provider.countInputTokens(call, new AbortController().signal)).toBe(call.input_token_upper_bound);
  expect(transport).not.toHaveBeenCalled();
  await provider.verifyAvailability(new AbortController().signal);
  const result = await provider.invoke(call, new AbortController().signal);
  expect(result.output.summary).toBe("Prueba sintética");
  expect(result.usage).toMatchObject({ output_tokens: 800, reasoning_tokens_if_available: 600 });
  expect(transport.mock.calls.map(c => c[0])).toEqual(["https://api.deepseek.com/models", "https://api.deepseek.com/responses"]);
  expect((call.payload as any).text.format).toMatchObject({ type: "json_schema", strict: true });
  expect(() => provider.prepareToolTurn()).toThrow("DEEPSEEK_DIRECTOR_TOOLS_NOT_ENABLED");
});

it("refuses missing keys and unavailable models without silently using Luna", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(response({ data: [] }));
  const missing = new DeepSeekProvider("deepseek-flash", "", schema, "JSON", "high", 1000000, 8000, transport);
  await expect(missing.verifyAvailability(new AbortController().signal)).rejects.toThrow("MISSING_DEEPSEEK_CREDENTIAL");
  expect(transport).not.toHaveBeenCalled();
  const absent = new DeepSeekProvider("deepseek-flash", "fake", schema, "JSON", "high", 1000000, 8000, transport);
  await expect(absent.verifyAvailability(new AbortController().signal)).rejects.toThrow("MODEL_ID_NOT_AVAILABLE");
});

it("preserves incomplete-response usage and refuses a substituted model", async () => {
  for (const [result, error] of [
    [{ model: "deepseek-flash", status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, "INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS"],
    [{ model: "other", status: "completed" }, "UNEXPECTED_MODEL_ID"],
  ] as const) {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ data: [{ id: "deepseek-flash" }] })).mockResolvedValueOnce(response({ ...result, usage: { input_tokens: 50, output_tokens: 100 } }));
    const provider = new DeepSeekProvider("deepseek-flash", "fake", schema, "JSON", "high", 1000000, 8000, transport);
    await provider.verifyAvailability(new AbortController().signal);
    await expect(provider.invoke(provider.prepare({}), new AbortController().signal)).rejects.toThrow(error);
    expect(transport).toHaveBeenCalledTimes(2);
  }
});
