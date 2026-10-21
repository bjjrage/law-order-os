import {readFile,mkdir,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CorpusStore} from './library-corpus-store.mjs';
import {LocalOcr} from './library-ocr.mjs';
import {ingestRecord} from './library-record-ingest.mjs';
import {atomicLibraryJson} from './library-atomic.mjs';
import {libraryProcessRunning} from './library-process.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=resolve(root,'local-browser/library/research');await mkdir(dir,{recursive:true});
const file=resolve(dir,'ocr-load.lock');let lock=await open(file,'wx').catch(async e=>{
 if(e.code!=='EEXIST')throw e;const old=JSON.parse(await readFile(file,'utf8').catch(()=>'{}'));if(await libraryProcessRunning(old.pid,'library-ocr-load.mjs'))throw Error('OCR_JOB_ALREADY_RUNNING');await unlink(file);return open(file,'wx');
});await lock.writeFile(JSON.stringify({pid:process.pid}));await lock.close();
const db=new CorpusStore(resolve(dir,'corpus.sqlite')),ocr=new LocalOcr(root);let last=0,writing=null;
const state={status:'RUNNING',pid:process.pid,started_at:new Date().toISOString(),documents_processed:0,current_document:null,paid_calls:0};
async function progress(force=false){if(writing){await writing;if(!force)return;}if(!force&&Date.now()-last<1500)return;last=Date.now();state.updated_at=new Date().toISOString();
 const counts={indexed_documents:Number(db.db.prepare('SELECT count(*) AS n FROM sources').get().n),discovered_documents:Number(db.db.prepare('SELECT count(*) AS n FROM library_records').get().n),indexed_passages:Number(db.db.prepare('SELECT count(*) AS n FROM passages_docsize').get().n),ocr_documents:Number(db.db.prepare("SELECT count(*) AS n FROM sources WHERE coalesce(json_extract(metadata,'$.ocr.pages_processed'),0)>0").get().n)};
 writing=atomicLibraryJson(resolve(dir,'ocr-load-progress.json'),{...state,...counts}).catch(()=>{}).finally(()=>{writing=null;});await writing;
}
const pending=db.db.prepare(`SELECT r.record FROM library_records r JOIN ingestion i ON i.id=r.id LEFT JOIN job_state j ON j.id='ocr-attempt:'||r.id WHERE i.status IN ('OCR_PENDING','IMAGE_ONLY','INDEXED_PARTIAL','OCR_REVIEW_REQUIRED') AND j.id IS NULL LIMIT 1`);
try{
 for(;;){
  let row=pending.get(),audit=false;
  if(!row){
   const old=db.db.prepare("SELECT s.metadata FROM sources s LEFT JOIN job_state j ON j.id='page-audit:'||s.id WHERE json_extract(s.metadata,'$.content_format')='PDF' AND json_extract(s.metadata,'$.extraction_status') IS NULL AND j.id IS NULL LIMIT 1").get();
   if(old){const s=JSON.parse(old.metadata);row=db.db.prepare('SELECT record FROM library_records WHERE id=?').get(s.id)??{record:JSON.stringify({id:s.id,type:s.document_type??(s.kind==='OFFICIAL_CASELAW'?'Jurisprudencia':'Código'),title:s.title,url:s.url,source:s.publisher,source_url:s.url,date:s.published_date??'',year:s.published_date?.slice(0,4)??'',text_indexed:true})};audit=true;}
  }
  if(!row){state.current_document=null;await progress(true);const loader=JSON.parse(await readFile(resolve(dir,'full-load-progress.json'),'utf8').catch(()=>'{}'));if(loader.status==='COMPLETED_AVAILABLE_QUEUE')break;await new Promise(done=>setTimeout(done,5000));continue;}
  const record=JSON.parse(row.record);db.register([record]);state.current_document={id:record.id,title:record.title,type:record.type,page:null,total_pages:null,reading_scan:true};await progress(true);
  try{
   await ingestRecord(record,{root,db,ocr,onPage:p=>{state.current_document={...state.current_document,page:p.page,total_pages:p.total,reading_scan:p.stage==='OCR'};void progress().catch(()=>{});}});
   db.state('ocr-attempt:'+record.id,{completed_at:new Date().toISOString()});if(audit)db.state('page-audit:'+record.id,{completed_at:new Date().toISOString()});
  }catch(e){if(e.message==='DISK_RESERVE_REACHED')throw e;db.mark(record.id,'OCR_REVIEW_REQUIRED',e.message);db.state('ocr-attempt:'+record.id,{error:e.message,attempted_at:new Date().toISOString()});if(audit)db.state('page-audit:'+record.id,{error:e.message});}
  state.documents_processed++;await progress(true);
 }
 state.status='COMPLETED_AVAILABLE_QUEUE';state.current_document=null;await progress(true);
}catch(e){state.status='STOPPED';state.error=e.message;await progress(true);process.exitCode=1;}
finally{await ocr.close();db.close();await unlink(file).catch(()=>{});}
