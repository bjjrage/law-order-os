import { writeFile, mkdir } from "node:fs/promises";
import { loadConfiguration } from "./junta-setup.mjs";
import { createLiveProviders } from "../dist/providers/live.js";
import { configFromEnv } from "../dist/providers/config.js";
const { env } = await loadConfiguration();
const providers = createLiveProviders(env, configFromEnv(env));
const stages = [];
for (const [stage, provider] of Object.entries(providers)) {
  try {
    await provider.verifyAvailability(AbortSignal.timeout(15000));
    stages.push({ stage, status: "PASS", model_id: provider.model_id });
  } catch (error) {
    stages.push({
      stage,
      status: "BLOCKED",
      code: /^[A-Z0-9_]+$/.test(error.code ?? "")
        ? error.code
        : "METADATA_CHECK_FAILED",
    });
  }
}
const result = {
  checked_at: new Date().toISOString(),
  scope: "MODEL_METADATA_ONLY",
  generation: "NOT_RUN",
  credential_precedence: "NONEMPTY_DOTENV_FIRST",
  stages,
  paid_calls: 0,
};
await mkdir(".local-dev", { recursive: true });
await writeFile(
  ".local-dev/junta-metadata.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
