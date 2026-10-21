import {readFile,mkdir,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CorpusStore} from './library-corpus-store.mjs';
import {discoverAll} from './library-discovery.mjs';
import {ingestRecord} from './library-record-ingest.mjs';
import {officialUrl} from './library-research.mjs';
import {atomicLibraryJson} from './library-atomic.mjs';
import {libraryProcessRunning} from './library-process.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=resolve(root,'local-browser/library/research');
await mkdir(dir,{recursive:true});
const lockPath=resolve(dir,'full-load.lock');
let lock=await open(lockPath,'wx').catch(async e=>{
  if(e.code!=='EEXIST')throw e;
  const previous=JSON.parse(await readFile(lockPath,'utf8').catch(()=>'{}'));
  if(await libraryProcessRunning(previous.pid,'library-full-load.mjs'))throw Error('LIBRARY_JOB_ALREADY_RUNNING');
  await unlink(lockPath);return open(lockPath,'wx');
});
await lock.writeFile(JSON.stringify({pid:process.pid,started_at:new Date().toISOString()}));await lock.close();
const db=new CorpusStore(resolve(dir,'corpus.sqlite'));
const started=new Date().toISOString();let state={status:'RUNNING',phase:'PREPARING',pid:process.pid,started_at:started,updated_at:started,current_source:null,current_document:null,processed_this_run:0,indexed_this_run:0,ocr_this_run:0,downloaded_bytes:0,paid_calls:0,deployments:0};
let lastProgress=0,lastPublish=0,publishing=null,progressWrite=null;
const atomic=atomicLibraryJson;
function counts(){return {indexed_documents:Number(db.db.prepare('SELECT count(*) AS n FROM sources').get().n),ocr_documents:Number(db.db.prepare("SELECT count(*) AS n FROM sources WHERE coalesce(json_extract(metadata,'$.ocr.pages_processed'),0)>0").get().n),discovered_documents:Number(db.db.prepare('SELECT count(*) AS n FROM library_records').get().n),indexed_passages:Number(db.db.prepare('SELECT count(*) AS n FROM passages_docsize').get().n),statuses:Object.fromEntries(db.db.prepare('SELECT status,count(*) AS n FROM ingestion GROUP BY status').all().map(r=>[r.status,Number(r.n)]))};}
async function progress(force=false){
  if(progressWrite)return progressWrite;
  if(!force&&Date.now()-lastProgress<1500)return;lastProgress=Date.now();state.updated_at=new Date().toISOString();
  progressWrite=atomic(resolve(dir,'full-load-progress.json'),{...state,...counts(),sources:Object.fromEntries(db.db.prepare("SELECT id,value FROM job_state WHERE id LIKE 'discover:%'").all().map(r=>[r.id.slice(9),JSON.parse(r.value)]))}).catch(e=>{state.progress_warning=e.code??'WRITE_RETRY_REQUIRED';}).finally(()=>{progressWrite=null;});
  return progressWrite;
}
async function publish(force=false){
  if(publishing)return publishing;if(!force&&Date.now()-lastPublish<45000)return;
  publishing=(async()=>{
    const coverage=db.coverage(),indexed=new Set(coverage.sources.map(s=>s.id));
    const original=JSON.parse(await readFile(resolve(root,'apps/web/public/library/catalog.json'),'utf8'));
    const records=db.db.prepare('SELECT record FROM library_records ORDER BY id').all().map(r=>{const v=JSON.parse(r.record);return {...v,text_indexed:indexed.has(v.id)};});
    const catalog={...original,provenance:original.provenance??db.state('archive:catalog-provenance')??{},records,coverage:{...original.coverage,junta_connected:true,full_text_search:true,coverage_complete:false,scope:'Inventario público por repositorio; completitud universal no certificada.'}};
    const summary={...coverage,indexed_sources:coverage.sources.length,sources:coverage.sources.slice(0,100),full_source_list_in_database:true,discovered_records:records.length,engine:'SQLITE_FTS5_BM25',complete_library_indexed:false,types:coverage.sources.reduce((a,s)=>(a[s.document_type]=(a[s.document_type]??0)+1,a),{}),ocr_documents:coverage.sources.filter(s=>s.extraction_status==='OCR_TEXT_UNREVIEWED'||s.extraction_status==='PARTIAL_TEXT_UNREVIEWED').length,paid_calls:0,deployments:0};
    await atomic(resolve(root,'apps/web/public/library/catalog.json'),catalog);await atomic(resolve(root,'apps/web/public/library/research-coverage.json'),summary);await atomic(resolve(dir,'last-full-load-report.json'),summary);lastPublish=Date.now();
  })().catch(e=>{state.publication_warning=e.code??'WRITE_RETRY_REQUIRED';}).finally(()=>{publishing=null;});return publishing;
}
function eligible(record){
  if(!officialUrl(record.url)||['METADATA_CONFLICT','ORIGINAL_UNAVAILABLE'].includes(record.source_status))return false;
  if(record.id.startsWith('congreso-'))return false; // These are legislative files, not law bodies; BACN/CSJ supply the actual texts.
  if(!['Ley','Decreto','Jurisprudencia','Acordada','Resolución','Decreto Ley','Constitución','Código','Tratado'].includes(record.type))return false;
  if(db.has(record.id))return false;
  const status=db.status(record.id);return !status||['PENDING','IMAGE_ONLY'].includes(status);
}
async function processRecord(record){
  state.phase='INDEXING';state.current_document={id:record.id,title:record.title,type:record.type,page:null,total_pages:null};await progress(true);
  try{
    const source=await ingestRecord(record,{root,db,onPage:p=>{state.current_document={...state.current_document,page:p.page,total_pages:p.total_pages??p.total,reading_scan:false};void progress().catch(()=>{});},onDownload:n=>{state.downloaded_bytes+=n;}});
    state.indexed_this_run++;if(source.ocr?.pages_processed)state.ocr_this_run++;
    if(source.ocr?.unreadable_pages?.length)db.mark(record.id,'INDEXED_PARTIAL','PAGES_REQUIRE_REVIEW');
  }catch(e){
    if(e.message==='DISK_RESERVE_REACHED')throw e;
    const status=e.message==='IMAGE_ONLY_NO_OCR'?'OCR_PENDING':e.message==='OCR_REVIEW_REQUIRED'?'OCR_REVIEW_REQUIRED':/NO_SUPPORTED|OFFICIAL_ATTACHMENT_UNAVAILABLE/.test(e.message)?'METADATA_ONLY':'FAILED';db.mark(record.id,status,e.message);
  }
  state.processed_this_run++;await progress();await publish();
}
try{
  const initial=JSON.parse(await readFile(resolve(root,'apps/web/public/library/catalog.json'),'utf8'));db.register(initial.records);
  await progress(true);
  let discoveryFinished=false;
  const discovery=discoverAll({root,db,publish:()=>publish(),onProgress:p=>{state.current_source=p;void progress().catch(()=>{});}}).catch(e=>{state.discovery_error=e.message;}).finally(()=>{discoveryFinished=true;});
  const nextBatch=db.db.prepare(`SELECT r.record FROM library_records r LEFT JOIN sources s ON s.id=r.id LEFT JOIN ingestion i ON i.id=r.id
    WHERE s.id IS NULL AND (i.status IS NULL OR i.status='PENDING') AND r.id NOT LIKE 'congreso-%'
    AND json_extract(r.record,'$.type')=? AND coalesce(json_extract(r.record,'$.source_status'),'') NOT IN ('METADATA_CONFLICT','ORIGINAL_UNAVAILABLE')
    ORDER BY CASE WHEN r.id LIKE 'bacn-%' THEN 0 ELSE 1 END,r.id LIMIT 10`);
  for(;;){
    let processed=0;
    for(const type of ['Ley','Decreto','Jurisprudencia','Acordada','Resolución','Decreto Ley','Constitución','Código','Tratado'])for(const row of nextBatch.all(type)){
      const record=JSON.parse(row.record);if(!eligible(record)){db.mark(record.id,'METADATA_ONLY','NO_SUPPORTED_OFFICIAL_SOURCE');continue;}await processRecord(record);processed++;
    }
    if(!processed&&discoveryFinished)break;
    if(!processed){state.phase='DISCOVERING';await progress();await new Promise(done=>setTimeout(done,1000));}
  }
  await discovery;
  state.status='COMPLETED_AVAILABLE_QUEUE';state.phase='FINISHED';state.finished_at=new Date().toISOString();state.current_document=null;
  await publish(true);await progress(true);
}catch(e){state.status='STOPPED';state.phase='ATTENTION_REQUIRED';state.error=e.message;await publish(true).catch(()=>{});await progress(true).catch(()=>{});process.exitCode=1;}
finally{db.close();await unlink(lockPath).catch(()=>{});}
