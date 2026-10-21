import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import { workspaceModels } from "./workspace-models.mjs";
import { analysisLevels } from "../packages/workspace/src/analysis-levels.ts";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const stages = [
  ["Jev", "JEV_API_KEY", "JEV_MODEL"],
  ["Luna", "OPENAI_API_KEY", "OPENAI_LUNA_MODEL"],
  ["Sol", "OPENAI_API_KEY", "OPENAI_SOL_MODEL"],
  ["Gemini", "GEMINI_API_KEY", "GEMINI_AUDITOR_MODEL"],
];
function hasCredential(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/^(?:TU[_ -]|PEGAR|REEMPLAZAR|CHANGEME|YOUR[_ -]|<)/i.test(value.trim())
  );
}
export async function prepare(root = ROOT) {
  const template = await readFile(
    resolve(root, "junta-local/config.env.example"),
    "utf8",
  );
  try {
    await writeFile(resolve(root, ".env"), template, {
      flag: "wx",
      mode: 0o600,
    });
    return { env_file: "CREATED_EMPTY", overwritten: false };
  } catch (error) {
    if (error.code === "EEXIST")
      return { env_file: "PRESERVED", overwritten: false };
    throw Error("No se pudo preparar .env. Revisar permisos locales.");
  }
}
export async function loadConfiguration(root = ROOT, inherited = process.env) {
  const defaults = parseEnv(
    await readFile(resolve(root, "junta-local/config.env.example"), "utf8"),
  );
  let file = {},
    fileExists = false;
  try {
    file = parseEnv(await readFile(resolve(root, ".env"), "utf8"));
    fileExists = true;
  } catch (error) {
    if (error.code !== "ENOENT")
      throw Error("No se pudo leer la configuración local.");
  }
  const env = Object.fromEntries(
    Object.keys(defaults).map((key) => [
      key,
      file[key]?.trim() ? file[key] : inherited[key],
    ]),
  );
  return { defaults, file, fileExists, env };
}
export async function inspect(root = ROOT, inherited = process.env) {
  const { defaults, file, fileExists, env } = await loadConfiguration(
    root,
    inherited,
  );
  let lastCheck;
  try {
    lastCheck = JSON.parse(
      await readFile(resolve(root, ".local-dev/junta-metadata.json"), "utf8"),
    );
  } catch {}
  const providers = stages.map(([stage, key, model]) => ({
    stage,
    key_variable: key,
    key_present: hasCredential(env[key]),
    key_source: hasCredential(file[key])
      ? ".env"
      : hasCredential(inherited[key])
        ? "PROCESS_ENV"
        : "MISSING",
    // Only approved constants may reach logs/browser, never an arbitrary .env value.
    model_id: defaults[model],
    model_matches: env[model] === defaults[model],
    account_access: "NOT_VERIFIED",
    last_metadata_pass:
      Array.isArray(lastCheck?.stages) &&
      Date.now() - Date.parse(lastCheck.checked_at) >= 0 &&
      Date.now() - Date.parse(lastCheck.checked_at) < 86400000 &&
      lastCheck.stages.some(
        (s) =>
          s.stage === stage.toLowerCase() &&
          s.status === "PASS" &&
          s.model_id === defaults[model],
      ),
  }));
  for (const provider of providers)
    if (provider.last_metadata_pass)
      provider.account_access = "METADATA_VERIFIED";
  let policy = {};
  try {
    policy = JSON.parse(
      await readFile(
        resolve(root, ".local-dev/junta-browser-approval.json"),
        "utf8",
      ),
    );
  } catch {}
  const browserEnabled = policy.enabled === true && policy.max_cost_usd === 0.6;
  let currentPrices = false;
  try {
    const prices = JSON.parse(
      await readFile(
        resolve(root, "phase2/reports/model-connectivity-standard-prices.json"),
        "utf8",
      ),
    );
    currentPrices = providers.every((provider) =>
      prices.some(
        (price) =>
          price.model_id === provider.model_id &&
          price.mode === "STANDARD" &&
          Number.isFinite(price.input_per_million_usd) &&
          price.input_per_million_usd >= 0 &&
          Number.isFinite(price.output_per_million_usd) &&
          price.output_per_million_usd >= 0 &&
          Date.now() - Date.parse(price.as_of_date) >= 0 &&
          Date.now() - Date.parse(price.as_of_date) < 7 * 86400000,
      ),
    );
  } catch {}
  const ready =
    providers.every(
      (p) => p.key_present && p.model_matches && p.last_metadata_pass,
    ) &&
    env.OPENAI_SOL_REASONING_EFFORT === "medium" &&
    currentPrices;
  return {
    workflow: "legal-unified-v1",
    analysis_levels: Object.fromEntries(Object.entries(analysisLevels).map(([level, profile]) => {
      const models = workspaceModels(env, level);
      return [level, { label: profile.label, analyst_model: profile.model, reasoning_effort: profile.effort,
        analyst_key_present: hasCredential(models.analysis.key), auditor_model: "gemini-3.8-flash",
        fallback_auditor_model: "gpt-6-luna", controls: "workspace-quality-v1" }];
    })),
    mode: "LOCAL_PREPARATION",
    env_file_present: fileExists,
    providers,
    workspace_models: Object.fromEntries(Object.entries(workspaceModels(env)).map(([role, config]) => [role, {
      provider: config.provider,
      model_id: role === "analysis" ? analysisLevels.MEDIO.model : config.provider === "google" ? defaults.GEMINI_AUDITOR_MODEL : defaults.OPENAI_LUNA_MODEL,
      model_matches: config.model === (role === "analysis" ? analysisLevels.MEDIO.model : config.provider === "google" ? defaults.GEMINI_AUDITOR_MODEL : defaults.OPENAI_LUNA_MODEL),
      reasoning_effort: config.effort,
      key_present: hasCredential(config.key),
      account_access: "NOT_VERIFIED",
    }])),
    missing_keys: [
      ...new Set(
        providers.filter((p) => !p.key_present).map((p) => p.key_variable),
      ),
    ],
    model_configuration_ready:
      providers.every((p) => p.model_matches) &&
      env.OPENAI_SOL_REASONING_EFFORT === "medium",
    credential_presence_only: true,
    network_used: false,
    paid_calls: 0,
    execution_authorized: false,
    browser_execution_enabled: browserEnabled,
    query_budget_usd: browserEnabled ? 0.6 : null,
    current_prices_reviewed: currentPrices,
    real_execution: ready && browserEnabled ? "READY_PER_QUERY" : "BLOCKED",
    remaining_requirements: [
      ...(!providers.every((p) => p.last_metadata_pass)
        ? ["ACCOUNT_ACCESS_NOT_VERIFIED"]
        : []),
      ...(!browserEnabled ? ["BROWSER_APPROVAL_NOT_ENABLED"] : []),
      ...(!currentPrices ? ["CURRENT_PRICES_REQUIRE_REVIEW"] : []),
      "CONFIRM_EACH_QUERY_BUDGET",
    ],
    official_source_verification: "REQUIRES_INDEPENDENT_REVIEW",
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const command = process.argv[2] ?? "estado";
    if (!["preparar", "estado"].includes(command) || process.argv.length > 3)
      throw Error(
        "Solo se admite preparar o estado. Este comando no ejecuta proveedores.",
      );
    const prepared = command === "preparar" ? await prepare() : {};
    console.log(JSON.stringify({ ...prepared, ...(await inspect()) }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
