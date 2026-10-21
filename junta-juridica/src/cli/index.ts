import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { DocumentSchema, RequestSchema, type AccessContext, type BoardRun } from '../domain/contracts.js';
import { BoardError, bytesHash, hash as importFingerprint } from '../domain/guards.js';
import { FileBoardStore } from '../persistence/index.js';
import { OfficialEvidenceRegistry, TrustedVerifierSchema } from '../ingestion/provenance.js';
import { validateEvidenceBundle } from '../ingestion/bundle.js';
import { LegalBoard } from '../orchestration/index.js';
import { createOfflineProviders } from '../providers/offline.js';
import { createLiveProviders } from '../providers/live.js';
import { configFromEnv, requiredEnvironment } from '../providers/config.js';
import { assessLiveSmokeReadiness, LiveSmokePlanSchema, type MetadataProof } from '../providers/preflight.js';
import { costReport, PriceSchema } from '../telemetry/index.js';
import { citationLabel, DeterministicCitationChecker } from '../citation-checker/index.js';
import { demoFixture, DEMO_ACTOR, simulationPrices } from './demo.js';
import { runBenchmark } from './benchmark.js';
import { prepareIssuePlan } from '../orchestration/issue-plan.js';

const args=process.argv.slice(2);const command=args[0]??'smoke';
function arg(name:string):string|undefined{const index=args.indexOf(name);return index<0?undefined:args[index+1];}
function requiredArg(name:string):string{const value=arg(name);if(!value || value.startsWith('--'))throw new BoardError(`ARGUMENT_REQUIRED_${name}`);return value;}
const store=new FileBoardStore(resolve(arg('--data-dir')??'.board-data'));
const output=(value:unknown)=>process.stdout.write(JSON.stringify(value,null,2)+'\n');
async function saveDemoOriginals(f:ReturnType<typeof demoFixture>){
  for(const doc of f.documents){const bytes=Buffer.from(doc.text_spans.map(p=>p.text).join('\f'),'utf8');if(bytesHash(bytes)!==doc.original_hash_sha256)throw new BoardError('ORIGINAL_HASH_MISMATCH');await store.putImmutable(f.actor,f.request,'originals',doc.document_version_id,{original_hash_sha256:doc.original_hash_sha256,base64:bytes.toString('base64')});}
}
function safeExport(run:BoardRun,documents:ReturnType<typeof demoFixture>['documents'],registry=new OfficialEvidenceRegistry()){
  const checker=new DeterministicCitationChecker({registry,simulation:run.mode==='OFFLINE_SIMULATION'});const result=run.analysis?checker.checkAnalysis(run.analysis,documents,run.request.corpus_snapshot_id,run.request.jurisdiction):null;
  return {run_id:run.run_id,mode:run.mode,status:run.status,validity:run.validity,draft:run.draft,human_approval:run.human_approval,error_code:run.error_code,legal_analysis_untrusted_draft:run.analysis?.legal_analysis??null,
    reference_verification:result?.verification_gate??'NOT_CHECKED',references:result?.references.map((c,i)=>({reference:c,label:citationLabel(c,result.checks[i],run.request.corpus_snapshot_id,result.verification_gate)}))??[],citation_extraction:result?.extraction??null,cost:costReport(run)};
}
async function emitRun(run:BoardRun,documents:ReturnType<typeof demoFixture>['documents'],registry=new OfficialEvidenceRegistry()){
  const result=safeExport(run,documents,registry);const destination=arg('--output');
  if(destination){await writeFile(resolve(destination),JSON.stringify(result,null,2),{flag:'wx'});output({run_id:run.run_id,status:run.status,export_saved:true});}
  else if(run.mode==='LIVE')output({run_id:run.run_id,status:run.status,validity:run.validity,draft:run.draft,human_approval:run.human_approval,error_code:run.error_code,cost:costReport(run)});
  else output(result);
}
async function loadTrustRegistry(){
  const path=arg('--trust-file');
  const signers=path?z.array(TrustedVerifierSchema).parse(JSON.parse(await readFile(resolve(path),'utf8'))):[];
  return new OfficialEvidenceRegistry(signers);
}
async function main(){
  if(command==='live-preflight' || command==='live-smoke'){
    if(command==='live-smoke' && !args.includes('--authorize-paid-calls'))throw new BoardError('EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED');
    const readJson=async(path:string)=>JSON.parse((await readFile(resolve(path),'utf8')).replace(/^\uFEFF/u,''));
    const plan=LiveSmokePlanSchema.parse(await readJson(requiredArg('--plan')));
    const prices=z.array(PriceSchema).parse(await readJson(requiredArg('--price-file')));
    const metadata=await readJson(requiredArg('--metadata-file')) as MetadataProof[];
    const rawBundle=arg('--bundle')?await readJson(requiredArg('--bundle')):undefined;
    const evidencePack=arg('--evidence-pack')?await readJson(requiredArg('--evidence-pack')):undefined;
    const registry=await loadTrustRegistry();
    const assessment=await assessLiveSmokeReadiness({plan,prices,metadata,bundle:rawBundle,evidence_pack:evidencePack,registry,env:process.env});
    if(command==='live-preflight' || assessment.status!=='READY_FOR_AUTHORIZATION'){
      output(assessment);if(assessment.status!=='READY_FOR_AUTHORIZATION')process.exitCode=2;return;
    }
    // Future-only paid route: the exact frozen plan controls every engine limit.
    // Preflight is pure and never conveys authorization by itself.
    const {bundle,index,snapshot}=validateEvidenceBundle(rawBundle,registry);
    const providers=createLiveProviders(process.env,plan.config);
    for(const provider of Object.values(providers))await provider.verifyAvailability(AbortSignal.timeout(15000));
    for(const original of bundle.originals)await store.putImmutable(bundle.actor,bundle.request,'originals',original.document_version_id,original);
    await store.putImmutable(bundle.actor,bundle.request,'evidence-attestations',snapshot.snapshot_id,bundle.attestations);
    await store.putImmutable(bundle.actor,bundle.request,'live-smoke-plan',plan.request_id,{plan,assessment,evidence_pack:evidencePack});
    const controller=new AbortController();const cancel=()=>controller.abort();process.once('SIGINT',cancel);
    try{
      const run=await new LegalBoard(index,store,providers,plan.config,prices,registry).execute(bundle.actor,bundle.request,snapshot,{signal:controller.signal,authorize_paid_calls:true});
      await emitRun(run,bundle.documents,registry);if(run.status!=='HUMAN_REVIEW_PENDING')process.exitCode=1;
    }finally{process.removeListener('SIGINT',cancel);}
    return;
  }
  if(command==='connectivity'){
    const configured=requiredEnvironment(process.env);if(!args.includes('--verify')){output({status:'NOT_RUN',stages:configured,network_used:false});return;}
    const providers=createLiveProviders(process.env,configFromEnv(process.env));const results=[];
    for(const [stage,provider] of Object.entries(providers)){try{await provider.verifyAvailability(AbortSignal.timeout(15000));results.push({stage,status:'PASS',model_id:provider.model_id,scope:'MODEL_METADATA_ONLY; generation NOT_RUN'});}catch(e){results.push({stage,status:'BLOCKED',reason:e instanceof BoardError?e.code:'CONNECTIVITY_ERROR'});}}
    output({stages:results});if(results.some(r=>r.status==='BLOCKED'))process.exitCode=2;return;
  }
  if(command==='benchmark'){
    const report=await runBenchmark();const reportDir=resolve(arg('--report-dir')??'junta-juridica/reports');await mkdir(reportDir,{recursive:true});await writeFile(resolve(reportDir,'benchmark-offline.json'),JSON.stringify(report,null,2));output(report);if(report.status!=='PASS')process.exitCode=1;return;
  }
  if(command==='smoke'){
    const f=demoFixture(arg('--request-id')??'demo-offline-v3');await saveDemoOriginals(f);
    const board=new LegalBoard(f.index,store,createOfflineProviders(configFromEnv(process.env)),configFromEnv(process.env),simulationPrices());
    const run=await board.execute(f.actor,f.request,f.snapshot);await emitRun(run,f.documents);const reportDir=resolve(arg('--report-dir')??'junta-juridica/reports');await mkdir(reportDir,{recursive:true});await writeFile(resolve(reportDir,'smoke-offline.json'),JSON.stringify(safeExport(run,f.documents),null,2));if(run.status!=='HUMAN_REVIEW_PENDING')process.exitCode=1;return;
  }
  if(command==='show'){
    const actor:AccessContext={user_id:requiredArg('--user'),study_id:requiredArg('--study'),allowed_matter_ids:[requiredArg('--matter')]};
    const scope={study_id:actor.study_id,matter_id:actor.allowed_matter_ids[0]!};const run=await store.loadRun(actor,scope,requiredArg('--run-id'));if(!run)throw new BoardError('RUN_NOT_FOUND');
    const snapshot=await store.getImmutable<{documents:ReturnType<typeof demoFixture>['documents']}>(actor,scope,'evidence-snapshots',run.request.matter_snapshot_id);const registry=await loadTrustRegistry();
    if(arg('--trust-file')){const records=await store.getImmutable<import('../ingestion/provenance.js').OfficialAttestation[]>(actor,scope,'evidence-attestations',run.request.matter_snapshot_id);for(const doc of snapshot?.documents??[]){const record=records?.find(r=>r.claims.document_fingerprint===importFingerprint(doc));if(record)registry.register(doc,record);}}
    await emitRun(run,snapshot?.documents??[],registry);return;
  }
  if(command==='plan'){
    const bundle=JSON.parse(await readFile(requiredArg('--bundle'),'utf8')) as {actor:AccessContext;plan:unknown};output(prepareIssuePlan(bundle.actor,bundle.plan));return;
  }
  if(command==='recover'){
    if(!args.includes('--ack-no-replay'))throw new BoardError('EXPLICIT_RECOVERY_ACKNOWLEDGEMENT_REQUIRED');
    const actor:AccessContext={user_id:requiredArg('--user'),study_id:requiredArg('--study'),allowed_matter_ids:[requiredArg('--matter')]};
    const run=await store.recoverInterrupted(actor,{study_id:actor.study_id,matter_id:actor.allowed_matter_ids[0]!},requiredArg('--run-id'));output({status:run?.status??'NOT_FOUND',run_id:run?.run_id??null,error_code:run?.error_code??null,replayed:false});return;
  }
  if(command==='live'){
    if(!args.includes('--authorize-paid-calls'))throw new BoardError('EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED');
    // Validate originals and externally configured provenance before any network.
    const registry=await loadTrustRegistry();
    const {bundle,index,snapshot}=validateEvidenceBundle(JSON.parse(await readFile(requiredArg('--bundle'),'utf8')),registry);
    const prices=z.array(PriceSchema).parse(JSON.parse(await readFile(requiredArg('--price-file'),'utf8')));
    const providers=createLiveProviders(process.env,configFromEnv(process.env));
    const missing=requiredEnvironment(process.env).filter(s=>s.status==='BLOCKED');if(missing.length){output({status:'BLOCKED',stages:missing});process.exitCode=2;return;}
    for(const provider of Object.values(providers))await provider.verifyAvailability(AbortSignal.timeout(15000));
    for(const original of bundle.originals)await store.putImmutable(bundle.actor,bundle.request,'originals',original.document_version_id,original);
    await store.putImmutable(bundle.actor,bundle.request,'evidence-attestations',snapshot.snapshot_id,bundle.attestations);
    const controller=new AbortController();const cancel=()=>controller.abort();process.once('SIGINT',cancel);
    try{const run=await new LegalBoard(index,store,providers,configFromEnv(process.env),prices,registry).execute(bundle.actor,bundle.request,snapshot,{signal:controller.signal,authorize_paid_calls:true});await emitRun(run,bundle.documents,registry);if(run.status!=='HUMAN_REVIEW_PENDING')process.exitCode=1;}finally{process.removeListener('SIGINT',cancel);}return;
  }
  throw new BoardError('UNKNOWN_COMMAND');
}
main().catch(e=>{output({status:'BLOCKED',error_code:e instanceof BoardError?e.code:e instanceof z.ZodError?'CONTRACT_VALIDATION_ERROR':'CLI_ERROR'});process.exitCode=2;});
