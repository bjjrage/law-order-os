import { z } from "zod";
import { readFile, writeFile, mkdir, open, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { loadConfiguration } from "./junta-setup.mjs";
import { ingestText } from "../dist/ingestion/index.js";
import { validateEvidenceBundle } from "../dist/ingestion/bundle.js";
import { OfficialEvidenceRegistry } from "../dist/ingestion/provenance.js";
import { LocalEvidenceIndex } from "../dist/retrieval/index.js";
import { hash, bytesHash, requireDelimitedQuestion } from "../dist/domain/guards.js";
import { DEFAULT_CONFIG, EXPECTED_MODELS } from "../dist/providers/config.js";
import { createOfflineProviders } from "../dist/providers/offline.js";
import { LegalBoard } from "../dist/orchestration/index.js";
import { FileBoardStore } from "../dist/persistence/index.js";
import { PriceSchema, tokenCost, costReport } from "../dist/telemetry/index.js";
import { researchCase, researchContext, researchUsage } from './library-research.mjs';
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const id = z.string().min(1).max(128);
const Input = z
  .object({
    study_id: id,
    matter_id: id,
    actor_id: z.enum(["local-administrator", "local-lawyer"]),
    question: z.string().trim().min(15).max(2000),
    scope: z.string().trim().min(5).max(2000),
    as_of_date: z.iso.date(),
    synthetic_data: z.literal(true),
    consultation_mode: z.enum(['DOCUMENT_REVIEW', 'GENERAL']).default('DOCUMENT_REVIEW'),
    execution_mode: z.enum(['LIVE', 'OFFLINE_TEST']).default('LIVE'),
    include_library: z.boolean().default(true),
    subject_area: z.string().max(100).optional(),
    documents: z
      .array(
        z
          .object({
            id,
            version_id: id,
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            title: z.string().min(1).max(240),
            base64: z.string().min(4).max(20000),
            nature: z.enum(["DOCUMENT_CONTENT", "PARTY_ALLEGATION", "UNKNOWN"]),
          })
          .strict(),
      )
      .max(4),
  })
  .strict().refine(input => input.consultation_mode === 'GENERAL' || input.documents.length > 0, {
    message: 'La revisión documental requiere originales.', path: ['documents'],
  });
const CONFIG = {
  ...DEFAULT_CONFIG,
  max_cost_usd: 0.6,
  max_retries: 0,
  max_retrievals: 0,
  candidate_limit: 12,
  router_batch_size: 12,
  router_batch_token_limit: 24000,
};
function failure(code) {
  const error = Error(code);
  error.code = code;
  throw error;
}
const safeId = (value) => z.uuid().parse(value);
const casePath = (root, id) =>
  resolve(root, ".board-data/case-junta", safeId(id) + ".json");
function offlinePrices(asOf) {
  return Object.values(createOfflineProviders(CONFIG)).map(provider => ({
    model_id: provider.model_id, input_per_million_usd: 0, output_per_million_usd: 0,
    source: 'CONTROLLED_OFFLINE_TEST_NO_BILLING', as_of_date: asOf, mode: 'SIMULATION',
  }));
}
export async function prepareCase(raw, root = ROOT) {
  if (raw?.execution_mode !== "OFFLINE_TEST") failure("LEGAL_WORKFLOW_UNIFIED");
  const input = Input.parse(raw),
    actor = {
      user_id: input.actor_id,
      study_id: input.study_id,
      allowed_matter_ids: [input.matter_id],
    };
  const ids = new Set(),
    versionIds = new Set();
  let total = 0;
  const imported = input.documents.map((d) => {
    if (ids.has(d.id) || versionIds.has(d.version_id))
      failure("DUPLICATE_DOCUMENT_VERSION");
    ids.add(d.id);
    versionIds.add(d.version_id);
    const bytes = Buffer.from(d.base64, "base64");
    total += bytes.length;
    if (
      !bytes.length ||
      total > 12000 ||
      bytes.toString("base64") !== d.base64 ||
      bytesHash(bytes) !== d.sha256
    )
      failure("DOCUMENT_BYTES_OR_HASH_INVALID");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return ingestText(
      actor,
      {
        document_id: d.id,
        document_version_id: d.version_id,
        study_id: input.study_id,
        matter_id: input.matter_id,
        source_type: "PRIVATE_MATTER",
        origin_uri: `local-matter://${input.matter_id}/${d.version_id}`,
        verification_status: "UNVERIFIED",
        authority_record: null,
        extraction_quality: "GOOD",
        is_test_fixture: false,
        metadata: {
          jurisdiction: "PY",
          court: null,
          chamber: null,
          resolution_type: null,
          number: null,
          date: null,
          official_id: null,
          valid_from: null,
          valid_to: null,
        },
        pages: text.split("\f").map((text) => ({ text, nature: d.nature })),
      },
      bytes,
    );
  });
  const documents = imported.map((item) => item.document),
    current = Object.fromEntries(
      documents.map((d) => [d.document_id, d.document_version_id]),
    );
  const index = new LocalEvidenceIndex(documents, undefined, current),
    snapshot = index.snapshot(actor, {
      study_id: input.study_id,
      matter_id: input.matter_id,
    });
  const preparedId = randomUUID();
  const library_research=input.include_library?await researchCase(root,input.question,(input.subject_area??'')+' '+input.scope,input.documents.map(d=>Buffer.from(d.base64,'base64').toString('utf8')).join('\n'),input.as_of_date):undefined;
  const request = {
    request_id: preparedId,
    study_id: input.study_id,
    matter_id: input.matter_id,
    requested_by: input.actor_id,
    jurisdiction: "PY",
    legal_question: input.question,
    ...(input.consultation_mode === 'GENERAL' ? {consultation_mode: 'GENERAL'} : {}),
    scope:
      input.scope +
      " Separar alegaciones de hechos documentales. La investigación de Biblioteca se entrega separadamente como bibliografía pendiente de cotejo; nunca acredita hechos ni vigencia. No afirmar referencias como auténticas sin verificación.",
    as_of_date: input.as_of_date,
    matter_snapshot_id: snapshot.snapshot_id,
    corpus_snapshot_id: snapshot.snapshot_id,
    selected_document_ids: documents.map((d) => d.document_id),
    max_cost_usd: CONFIG.max_cost_usd,
  };
  const bundle = {
    actor,
    request,
    documents,
    originals: imported.map((d) => ({
      document_version_id: d.document.document_version_id,
      base64: d.original_base64,
    })),
    attestations: [],
    current_document_versions: current,
  };
  requireDelimitedQuestion(request);
  validateEvidenceBundle(bundle, new OfficialEvidenceRegistry());
  const offline = input.execution_mode === 'OFFLINE_TEST';
  const prices = offline ? offlinePrices(input.as_of_date) : z
    .array(PriceSchema)
    .parse(
      JSON.parse(
        await readFile(
          resolve(
            root,
            "phase2/reports/model-connectivity-standard-prices.json",
          ),
          "utf8",
        ),
      ),
    );
  const ceilings = {
    jev: [60000, 4000],
    luna: [60000, 16000],
    sol: [60000, 25000],
    gemini: [100000, 16000],
  };
  const reserved = offline ? 0 : Object.entries(EXPECTED_MODELS)
    .map(([stage, model]) => {
      const matches = prices.filter(
        (p) => p.model_id === model && p.mode === "STANDARD",
      );
      if (matches.length !== 1) failure("CURRENT_PRICE_REQUIRED");
      return tokenCost(matches[0], ...ceilings[stage]);
    })
    .reduce((a, b) => a + b, 0);
  if (reserved > CONFIG.max_cost_usd) failure("BUDGET_EXHAUSTED");
  const unsigned = {
    prepared_id: preparedId,
    created_at: new Date().toISOString(),
    synthetic_data: true,
    execution_mode: input.execution_mode,
    bundle,
    ...(library_research?{library_research}:{}),
    config: CONFIG,
    prices,
    price_valid_until: offline ? null : "2026-10-20",
    reserved_ceiling_usd: reserved,
  };
  const prepared = { ...unsigned, prepared_hash: hash(unsigned) };
  await mkdir(resolve(root, ".board-data/case-junta"), { recursive: true });
  await writeFile(casePath(root, preparedId), JSON.stringify(prepared), {
    flag: "wx",
    mode: 0o600,
  });
  return caseSummary(prepared);
}
export function caseSummary(prepared) {
  return {
    prepared_id: prepared.prepared_id,
    prepared_hash: prepared.prepared_hash,
    question: prepared.bundle.request.legal_question,
    study_id: prepared.bundle.request.study_id,
    matter_id: prepared.bundle.request.matter_id,
    snapshot_id: prepared.bundle.request.matter_snapshot_id,
    consultation_mode: prepared.bundle.request.consultation_mode ?? 'DOCUMENT_REVIEW',
    execution_mode: prepared.execution_mode ?? 'LIVE',
    documents: prepared.bundle.documents.map((d) => ({
      document_id: d.document_id,
      version_id: d.document_version_id,
      sha256: d.original_hash_sha256,
    })),
    budget_usd: prepared.execution_mode === 'OFFLINE_TEST' ? 0 : prepared.config.max_cost_usd,
    reserved_ceiling_usd: prepared.reserved_ceiling_usd,
    price_valid_until: prepared.price_valid_until,
    synthetic_data: true,
    library_research: prepared.library_research,
    limitations: [
      ...(prepared.library_research?prepared.library_research.limitations:["Esta consulta se preparó sin investigación de Biblioteca."]),
      "No acredita jurisprudencia ni vigencia normativa. Revisión humana obligatoria.",
    ],
    status: "PREPARED_NOT_EXECUTED",
  };
}
export async function loadCase(id, root = ROOT) {
  const prepared = JSON.parse(await readFile(casePath(root, id), "utf8"));
  const { prepared_hash, ...unsigned } = prepared;
  if (prepared.prepared_id !== id || hash(unsigned) !== prepared_hash)
    failure("PREPARED_HASH_MISMATCH");
  return prepared;
}
async function caseGrant(prepared, root){
  return JSON.parse(await readFile(resolve(root,'.local-dev/junta-approvals',prepared.prepared_id+'.json'),'utf8').catch(()=>readFile(resolve(root,'.local-dev/junta-authorization.json'),'utf8')));
}
export async function caseAuthorized(prepared, root = ROOT) {
  if(prepared.execution_mode === 'OFFLINE_TEST')return false;
  try {
    const grant = await caseGrant(prepared,root);
    return (
      grant.prepared_id === prepared.prepared_id &&
      grant.prepared_hash === prepared.prepared_hash &&
      grant.max_cost_usd === prepared.config.max_cost_usd &&
      grant.authorize_paid_calls === true &&
      Date.parse(grant.expires_at) > Date.now() &&
      grant.owner_approval === true
    );
  } catch {
    return false;
  }
}
// Interactive approval is explicit and scoped to this frozen case. The host
// must opt into browser approvals; no GET, preparation or checkbox alone spends.
export async function consultCase(raw, root = ROOT, transport) {
  const consent=z.object({prepared_id:z.uuid(),owner_approval:z.literal(true),max_cost_usd:z.literal(0.6),synthetic_data:z.literal(true)}).strict().parse(raw);
  const policy=JSON.parse(await readFile(resolve(root,'.local-dev/junta-browser-approval.json'),'utf8').catch(()=>'{"enabled":false}'));
  if(policy.enabled!==true||policy.max_cost_usd!==0.6)failure('BROWSER_APPROVAL_NOT_ENABLED');
  const prepared=await loadCase(consent.prepared_id,root);
  if(prepared.execution_mode === 'OFFLINE_TEST')failure('OFFLINE_CASE_CANNOT_AUTHORIZE_PAID_CALLS');
  if(prepared.config.max_cost_usd!==consent.max_cost_usd)failure('BUDGET_CONSENT_MISMATCH');
  const dir=resolve(root,'.local-dev/junta-approvals');await mkdir(dir,{recursive:true});
  const grant={prepared_id:prepared.prepared_id,prepared_hash:prepared.prepared_hash,max_cost_usd:consent.max_cost_usd,authorize_paid_calls:true,owner_approval:true,approval_source:'EXPLICIT_LOCAL_BROWSER_CONSULT_BUTTON',approved_at:new Date().toISOString(),expires_at:new Date(Date.now()+15*60000).toISOString()};
  const file=await open(resolve(dir,prepared.prepared_id+'.json'),'wx').catch(e=>{if(e.code==='EEXIST')return null;throw e;});
  if(file){try{await file.writeFile(JSON.stringify(grant,null,2));}finally{await file.close();}}
  return runCase(prepared.prepared_id,root,transport);
}
export async function runCase(id, root = ROOT, transport) {
  const prepared = await loadCase(id, root);
  if(prepared.execution_mode === 'OFFLINE_TEST')return runOfflineCase(prepared,root);
  failure("LEGAL_WORKFLOW_UNIFIED");

}
async function runOfflineCase(prepared, root) {
  // This branch never loads credentials, creates spending grants or constructs
  // HTTP adapters. The same board, provenance checks and terminal checker run
  // with explicitly simulated providers and a zero price table.
  const {bundle,index,snapshot,registry}=validateEvidenceBundle(prepared.bundle,new OfficialEvidenceRegistry());
  const providers=createOfflineProviders(prepared.config);
  const store=new FileBoardStore(resolve(root,'.board-data/case-junta/runs'));
  const run=await new LegalBoard(index,store,providers,prepared.config,prepared.prices,registry).execute(
    bundle.actor,bundle.request,snapshot,{library_research:researchContext(prepared.library_research),signal:AbortSignal.timeout(30000)},
  );
  return caseRun(run,prepared,root);
}
async function caseRun(run,prepared,root){
  const output=publicRun(run);
  output.library_research=researchUsage(prepared.library_research,run);
  const checkStage=run.stages.findLast(s=>s.stage_name==='CHECKING_REFERENCES'&&s.output_snapshot_hash);
  if(checkStage){
    const store=new FileBoardStore(resolve(root,'.board-data/case-junta/runs'));
    const saved=await store.getImmutable(prepared.bundle.actor,run,'stage-artifacts',`${run.run_id}:citation-checks:${checkStage.output_snapshot_hash}`);
    if(saved?.value){
      const checked=saved.value;
      output.citation_review={completed:true,detected_mentions:checked.extraction.detected_reference_count,identified_references:checked.references.length,unresolved_mentions:checked.extraction.unresolved_markers.map(m=>m.text),verified_references:checked.checks.filter(c=>c.identity_status==='VERIFIED_IDENTITY'&&['QUOTE_MATCH','NOT_APPLICABLE'].includes(c.quote_status)).length,observations:checked.checks.filter(c=>c.identity_status!=='VERIFIED_IDENTITY'||!['QUOTE_MATCH','NOT_APPLICABLE'].includes(c.quote_status)).map(c=>({reason:c.reason,identity_status:c.identity_status,quote_status:c.quote_status}))};
    }
  }
  try {
    const start=await stat(resolve(root,'.board-data/case-junta',prepared.prepared_id+'.execution'));
    const terminal=['HUMAN_REVIEW_PENDING','PARTIAL','FAILED','CANCELLED'].includes(run.status);
    const finish=terminal?await stat(resolve(root,'.board-data/case-junta/runs',hash([run.study_id,run.matter_id]),hash('run-history'),hash(run.run_id+':'+hash(run))+'.json')):null;
    output.timing={started_at:start.mtime.toISOString(),finished_at:finish?.mtime.toISOString()??null,elapsed_ms:Math.max(0,(finish?.mtimeMs??Date.now())-start.mtimeMs),stage_time_ms:output.cost.latency_ms,source:'LOCAL_PERSISTENCE_TIMESTAMPS'};
  }catch{output.timing={started_at:null,finished_at:null,elapsed_ms:output.cost.latency_ms,stage_time_ms:output.cost.latency_ms,source:'STAGE_LATENCY_SUM'};}
  return output;
}
export function publicRun(run) {
  return {
    run_id: run.run_id,
    request_id: run.request_id,
    matter_id: run.matter_id,
    mode: run.mode,
    consultation_mode: run.request.consultation_mode ?? 'DOCUMENT_REVIEW',
    ...(run.mode === 'OFFLINE_SIMULATION' ? {network_used:false,paid_calls:0,legal_answer_generated:false} : {}),
    status: run.status,
    history: run.history,
    question: run.request.legal_question,
    analysis: run.analysis,
    packet: run.packet,
    audit: run.audit,
    references: run.citation_checks,
    reference_verification: run.reference_verification,
    stages: run.stages.map((s) => ({
      stage: s.stage_name,
      model_id: s.model_id,
      status: s.status,
      error_code: s.error_code,
      latency_ms: s.latency_ms,
      estimated_cost_usd: s.estimated_cost_usd,
      input_tokens: s.input_tokens,
      output_tokens: s.output_tokens,
    })),
    error_code: run.error_code,
    human_approval: run.human_approval,
    cost: costReport(run),
  };
}
export async function statusCase(id, root = ROOT) {
  const prepared = await loadCase(id, root),
    bundle = prepared.bundle;
  const store = new FileBoardStore(
    resolve(root, ".board-data/case-junta/runs"),
  );
  const run = await store.loadRun(
    bundle.actor,
    bundle.request,
    `run:${hash([bundle.request.study_id, bundle.request.matter_id, bundle.request.request_id]).slice(0, 32)}`,
  );
  return {
    ...caseSummary(prepared),
    execution_authorized: await caseAuthorized(prepared, root),
    run: run ? await caseRun(run,prepared,root) : null,
  };
}
