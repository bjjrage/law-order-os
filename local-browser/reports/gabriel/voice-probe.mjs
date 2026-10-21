// One explicit synthetic speech/transcription probe. A result file prevents accidental reruns.
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfiguration } from "../../../scripts/junta-setup.mjs";
import { encodeVoice } from "../../../apps/web/src/gabriel-audio.ts";
const dir = resolve("local-browser/reports/gabriel");
await mkdir(dir, { recursive: true });
const marker = await open(resolve(dir, "voice-probe-attempt.json"), "wx");
await marker.writeFile(
  JSON.stringify({ started_at: new Date().toISOString(), synthetic: true }),
);
await marker.close();
const { env } = await loadConfiguration();
const reply = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  redirect: "error",
  headers: {
    Authorization: "Bearer " + env.OPENAI_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "tts-1",
    voice: "onyx",
    input: "Gabriel, abrí Clientes.",
    response_format: "wav",
  }),
  signal: AbortSignal.timeout(45000),
});
if (!reply.ok) throw Error("Speech probe HTTP " + reply.status);
const wave = Buffer.from(await reply.arrayBuffer());
await writeFile(resolve(dir, "synthetic-command.wav"), wave);
let rate = 0,
  data;
for (let offset = 12; offset + 8 <= wave.length;) {
  const tag = wave.toString("ascii", offset, offset + 4),
    size = wave.readUInt32LE(offset + 4);
  if (tag === "fmt ") {
    if (
      wave.readUInt16LE(offset + 8) !== 1 ||
      wave.readUInt16LE(offset + 10) !== 1 ||
      wave.readUInt16LE(offset + 22) !== 16
    )
      throw Error("Unexpected WAV encoding");
    rate = wave.readUInt32LE(offset + 12);
  }
  if (tag === "data") {
    data = wave.subarray(offset + 8, Math.min(wave.length, offset + 8 + size));
    break;
  }
  offset += 8 + size + (size % 2);
}
if (!rate || !data) throw Error("No PCM data");
const samples = new Float32Array(data.length / 2);
for (let i = 0; i < samples.length; i++)
  samples[i] = data.readInt16LE(i * 2) / 32768;
const response = await fetch("http://127.0.0.1:4313/local/gabriel/transcribe", {
  method: "POST",
  headers: {
    Origin: "http://127.0.0.1:4313",
    "Content-Type": "audio/wav",
    "X-Gabriel": "1",
    "X-Request-Id": crypto.randomUUID(),
  },
  body: encodeVoice(samples, rate),
  signal: AbortSignal.timeout(45000),
});
const result = await response.json();
await writeFile(
  resolve(dir, "voice-probe-result.json"),
  JSON.stringify(
    {
      synthetic: true,
      timestamp: new Date().toISOString(),
      source_duration_seconds: samples.length / rate,
      speech_status: reply.status,
      transcription_status: response.status,
      ...result,
    },
    null,
    2,
  ),
);
console.log({
  speech_status: reply.status,
  transcription_status: response.status,
  text: result.text,
  error: result.error,
});
