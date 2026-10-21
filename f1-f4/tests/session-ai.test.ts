import { it, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
// prettier-ignore
// @ts-expect-error Native host module.
import {pcmDuration,runSessionAI,validateMinutes} from "../../scripts/session-ai.mjs";
function wav(seconds = 1) {
  const b = Buffer.alloc(44 + seconds * 32000);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  return b;
}
it("measures PCM sample data and rejects forged duration metadata", () => {
  expect(pcmDuration(wav(2))).toBe(2);
  const bad = wav();
  bad.writeUInt32LE(1, 28);
  expect(() => pcmDuration(bad)).toThrow("SESSION_PCM_WAV_REQUIRED");
  expect(() => pcmDuration(Buffer.from("fake"))).toThrow();
});
it("requires literal evidence for minutes and keeps actions unassigned", () => {
  const value = {
    summary: "Terms discussed",
    agreements: [
      { statement: "Review terms", evidence_quote: "review the terms" },
    ],
    disagreements: [],
    actions: [],
  };
  expect(
    validateMinutes(value, "We will review the terms.").agreements,
  ).toHaveLength(1);
  expect(() => validateMinutes(value, "Unrelated text")).toThrow(
    "SESSION_EVIDENCE_QUOTE_NOT_FOUND",
  );
});
it("processes every section of a long meeting with Luna and produces proposals without human assignments", async () => {
  const root = resolve(".local-dev/session-ai-tests", randomUUID());
  await mkdir(resolve(root, "phase2/reports"), { recursive: true });
  await writeFile(
    resolve(root, "phase2/reports/model-connectivity-standard-prices.json"),
    JSON.stringify([
      {
        model_id: "gpt-6-luna",
        mode: "STANDARD",
        as_of_date: new Date().toISOString().slice(0, 10),
        input_per_million_usd: 0.1,
        output_per_million_usd: 0.5,
      },
    ]),
  );
  let calls = 0;
  const pieces: string[] = [];
  const text =
    "We agreed to review terms.\n".repeat(1500) +
    "Final decision: verify delivery dates.";
  const result = await runSessionAI(
    root,
    {
      id: "transcript",
      revision: 1,
      payload: {
        type: "TRANSCRIPT",
        session_id: "session",
        status: "REVIEWED",
        text,
      },
    },
    { action: "MINUTES", budget_usd: 0.6 },
    {
      configuration: {
        approval: { enabled: true, max_cost_usd: 0.6 },
        env: { OPENAI_API_KEY: "synthetic", OPENAI_LUNA_MODEL: "gpt-6-luna" },
      },
      transport: async (url: string, options: any) => {
        if (url.includes("/models/"))
          return Response.json({ id: "gpt-6-luna" });
        calls++;
        const call = JSON.parse(options.body),
          transcript = JSON.parse(call.input[0].content).untrusted_evidence
            .transcript;
        pieces.push(transcript);
        const quote = transcript.includes("Final decision")
          ? "Final decision: verify delivery dates."
          : "We agreed to review terms.";
        return Response.json({
          model: "gpt-6-luna",
          status: "completed",
          usage: { input_tokens: 100, output_tokens: 50 },
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    summary: "Review discussion",
                    agreements: [
                      { statement: "Review", evidence_quote: quote },
                    ],
                    disagreements: [],
                    actions: [
                      { statement: "Review terms", evidence_quote: quote },
                    ],
                  }),
                },
              ],
            },
          ],
        });
      },
    },
  );
  expect(calls).toBeGreaterThan(1);
  expect(pieces.join("")).toBe(text);
  expect(result.payload.status).toBe("PROPOSED");
  expect(
    result.payload.actions.every(
      (a: any) => a.task_id === null && a.responsible_identity_id === null,
    ),
  ).toBe(true);
  expect(result.payload.agreements.join(" ")).toContain(
    "verify delivery dates",
  );
});
it("transcribes only after an explicit call, preserves audio provenance and proposed review state", async () => {
  const calls: any[] = [];
  const result = await runSessionAI(
    ".",
    { id: "recording", payload: { type: "RECORDING", session_id: "session" } },
    {
      action: "TRANSCRIBE",
      budget_usd: 0.6,
      wav_base64: wav().toString("base64"),
    },
    {
      configuration: {
        approval: { enabled: true, max_cost_usd: 0.6 },
        env: { OPENAI_API_KEY: "synthetic" },
      },
      transport: async (url: string, options: any) => {
        calls.push({ url, options });
        return Response.json({
          text: "We should review terms.",
          usage: { input_tokens: 25, output_tokens: 6 },
        });
      },
    },
  );
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe("https://api.openai.com/v1/audio/transcriptions");
  expect(calls[0].options.body.get("model")).toBe("gpt-4o-mini-transcribe");
  expect(result.payload.recording_ids).toEqual(["recording"]);
  expect(result.payload.status).toBe("PROPOSED");
  expect(result.cost_kind).toBe("ESTIMATED_FROM_DURATION");
  await expect(
    runSessionAI(
      ".",
      { payload: { type: "TRANSCRIPT", status: "PROPOSED" } },
      { action: "MINUTES", budget_usd: 0.6 },
      {
        configuration: {
          approval: { enabled: true, max_cost_usd: 0.6 },
          env: { OPENAI_API_KEY: "synthetic" },
        },
        transport: async () => {
          throw Error("Must not call");
        },
      },
    ),
  ).rejects.toThrow("SESSION_TRANSCRIPT_REVIEW_REQUIRED");
});
