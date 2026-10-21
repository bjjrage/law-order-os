import {readFile,mkdir,stat,statfs} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sha} from './library-corpus-store.mjs';
import {officialGet,parseBacnText,clean,decode} from './library-corpus-ingest.mjs';
import {officialUrl} from './library-research.mjs';
import {extractPdf} from './library-ocr.mjs';
import {atomicLibraryFile,atomicLibraryJson} from './library-atomic.mjs';
export async function ingestRecord(record,{root,db,ocr,onPage=()=>{},onDownload=()=>{}}){
  const dir=resolve(root,'local-browser/library/research');
  const free=await statfs(dir);if(free.bavail*free.bsize<10_000_000_000)throw Error('DISK_RESERVE_REACHED');
  await mkdir(resolve(dir,'originals'),{recursive:true});
  const path=resolve(dir,'originals',record.id+'.raw');let bytes=await readFile(path).catch(()=>null),contentUrl=record.url,originalPath=path;
  if(!bytes){const legacy=resolve(dir,'originals',record.id+'.pdf');bytes=await readFile(legacy).catch(()=>null);if(bytes)originalPath=legacy;}
  const download=async(url,file)=>{const r=await officialGet(url,{maxBytes:150_000_000});await atomicLibraryFile(file,r.bytes);onDownload(r.bytes.length);return r.bytes;};
  if(!bytes)bytes=await download(record.url,path);
  let isPdf=bytes.subarray(0,5).toString()==='%PDF-',pages,extraction,parsed,title=record.title,date=record.date||null;
  if(!isPdf&&record.source_status==='DETAIL_PAGE'){
    const html=bytes.toString('utf8');
    const pdfs=[...html.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)].map(m=>{const raw=new URL(decode(m[1]),record.url);if(raw.protocol==='http:'&&raw.hostname==='www.csj.gov.py')raw.protocol='https:';return officialUrl(raw.href);}).filter(Boolean);
    if(!pdfs.length)throw Error('OFFICIAL_ATTACHMENT_UNAVAILABLE');
    const matches=/Fecha Emisi[óo]n[^\d]*(\d{2})\/(\d{2})\/(\d{4})/i.exec(clean(html));if(matches)date=`${matches[3]}-${matches[2]}-${matches[1]}`;
    contentUrl=pdfs[0];originalPath=resolve(dir,'originals',record.id+'.attachment.raw');bytes=await readFile(originalPath).catch(()=>null)??await download(contentUrl,originalPath);isPdf=bytes.subarray(0,5).toString()==='%PDF-';
    if(pdfs.length>1)db.register(pdfs.slice(1).map(url=>({...record,id:record.id+'-adjunto-'+sha(url).slice(0,10),title:record.title+' · documento adjunto',url,date,source_status:'ORIGINAL_LINKED'})));
  }
  if(!isPdf&&new URL(record.url).hostname==='www.bacn.gov.py'){
    const html=bytes.toString('utf8');
    try{parsed=parseBacnText(html);pages=[{page:1,text:parsed.text,extraction_method:'DIGITAL'}];date=parsed.published_date;title=parsed.title||title;}
    catch(e){
      const match=[...html.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)].map(m=>officialUrl(new URL(decode(m[1]),record.url).href)).find(u=>u&&new URL(u).hostname==='www.bacn.gov.py'&&new URL(u).pathname.startsWith('/descarga/'));
      if(!match)throw e;
      contentUrl=match;originalPath=resolve(dir,'originals',record.id+'.attachment.raw');bytes=await readFile(originalPath).catch(()=>null)??await download(contentUrl,originalPath);isPdf=bytes.subarray(0,5).toString()==='%PDF-';
      title=clean(/<h1[^>]*class=["']entry-title["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]??title);
    }
  }
  if(isPdf){extraction=await extractPdf(bytes,{root,ocr,onPage});pages=extraction.pages;}
  else if(!pages)throw Error('NO_SUPPORTED_FULL_TEXT');
  const originalHash=sha(bytes),extractionHash=sha(JSON.stringify(pages));
  const source={id:record.id,title,url:contentUrl,source_url:record.url,publisher:record.source,kind:record.type==='Jurisprudencia'?'OFFICIAL_CASELAW':'LEGISLATION',document_type:record.type,publication_kind:record.type==='Jurisprudencia'?'Publicación judicial; identidad pendiente de cotejo':'Texto institucional; vigencia pendiente de cotejo',content_format:isPdf?'PDF':'HTML',published_date:date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:null,normative_status:record.normative_status??null,original_sha256:originalHash,extraction_sha256:extractionHash,fetched_at:(await stat(originalPath)).mtime.toISOString(),extraction_status:extraction?.extraction_status??'DIGITAL_TEXT_UNREVIEWED',...(extraction?{ocr:extraction.ocr}:{}),pages};
  await mkdir(resolve(dir,'texts'),{recursive:true});const out=resolve(dir,'texts',record.id+'-'+originalHash+'-'+extractionHash+'.json');
  await atomicLibraryJson(out,source);db.upsert(source);
  return source;
}
