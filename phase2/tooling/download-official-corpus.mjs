import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
const root=process.cwd(),sha=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(readFileSync('OFFICIAL_CORPUS_MANIFEST.json','utf8'));
const download=process.argv.includes('--download-missing');
const results=[];
for(const doc of manifest.documents){
  const target=resolve(doc.original_path),allowed=resolve('phase2/corpus/originals')+sep;
  if(!target.startsWith(allowed))throw Error('CORPUS_PATH_OUTSIDE_ARCHIVE');
  const url=new URL(doc.source_url);
  if(url.protocol!=='https:' || url.hostname!=='www.pj.gov.py' || url.username || url.password)throw Error('OFFICIAL_SOURCE_REQUIRED');
  let status='MISSING',actual=null;
  if(existsSync(target)){actual=sha(readFileSync(target));status=actual===doc.original_sha256?'PASS':'HASH_MISMATCH';}
  else if(download){
    const response=await fetch(doc.source_url,{redirect:'error',signal:AbortSignal.timeout(25000)});
    if(!response.ok)status='HTTP_'+response.status;
    else{
      const data=Buffer.from(await response.arrayBuffer());actual=sha(data);
      if(data.length>8*1024*1024 || data.subarray(0,5).toString()!=='%PDF-')status='INVALID_PDF';
      else if(actual!==doc.original_sha256)status='SOURCE_VERSION_CHANGED_REVIEW_REQUIRED';
      else{mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,data,{flag:'wx'});status='PASS';}
    }
  }
  results.push({source_document_id:doc.source_document_id,status,expected_sha256:doc.original_sha256,actual_sha256:actual});
}
const report={status:results.every(r=>r.status==='PASS')?'PASS':'BLOCKED',mode:download?'MISSING_ORIGINAL_DOWNLOAD_ALLOWED':'LOCAL_VERIFICATION_ONLY',
  paid_calls:0,originals_never_overwritten:true,results};
writeFileSync('phase2/reports/corpus-integrity.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=2;
