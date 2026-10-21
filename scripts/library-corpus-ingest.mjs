import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {getDocument,version} from '../phase2/tooling/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import {CorpusStore,sha} from './library-corpus-store.mjs';
import {officialUrl} from './library-research.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const entities={nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',ordm:'º',ordf:'ª',deg:'°',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',ntilde:'ñ',Aacute:'Á',Eacute:'É',Iacute:'Í',Oacute:'Ó',Uacute:'Ú',Ntilde:'Ñ',uuml:'ü',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',ndash:'–',mdash:'—',hellip:'…'};
export const decode=s=>String(s).replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(m,k)=>{if(k[0]==='#'){const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):m;}return entities[k]??m;});
export const clean=s=>decode(String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
export async function officialGet(raw,{transport=fetch,maxBytes=25_000_000}={}){
  let url=officialUrl(raw);if(!url)throw Error('OFFICIAL_URL_REQUIRED');
  const signal=AbortSignal.timeout(25000);
  for(let hop=0;hop<4;hop++){
    const r=await transport(url,{method:'GET',redirect:'manual',signal,headers:{'User-Agent':'LawOrderLocalCorpus/1.0 (public legal research; incremental cache)'}});
    if(r.status>=300&&r.status<400){const loc=r.headers.get('location');await r.body?.cancel();url=loc&&officialUrl(new URL(loc,url).href);if(!url)throw Error('UNSAFE_REDIRECT');continue;}
    if(!r.ok){await r.body?.cancel();throw Error('HTTP_'+r.status);}
    if(Number(r.headers.get('content-length'))>maxBytes){await r.body?.cancel();throw Error('SOURCE_TOO_LARGE');}
    const blocks=[];let count=0;
    for await(const b of r.body){count+=b.length;if(count>maxBytes){throw Error('SOURCE_TOO_LARGE');}blocks.push(b);}
    return {bytes:Buffer.concat(blocks),resolved_url:url,content_type:r.headers.get('content-type')??''};
  }throw Error('TOO_MANY_REDIRECTS');
}
export function bacnRecords(html){
  const records=new Map();
  for(const m of html.matchAll(/<a\b[^>]*href=["'](https:\/\/www\.bacn\.gov\.py\/leyes-paraguayas\/(\d+)\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const title=clean(m[3]),url=officialUrl(decode(m[1]));if(!url||title.length<8)continue;
    const id='bacn-'+m[2];if(records.has(id)&&records.get(id).title.length>=title.length)continue;
    records.set(id,{id,type:'Ley',title,url,number:/Ley\s*(?:N[º°o.]*)?\s*([\d.]+)/i.exec(title)?.[1]?.replace(/\./g,'')??'',year:/\/(20\d{2}|19\d{2})/.exec(title)?.[1]??'',source:'Biblioteca y Archivo Central del Congreso Nacional',source_url:'https://www.bacn.gov.py/leyes-paraguayas',date:'',notes:'Transcripción institucional; cotejar modificaciones y vigencia.',text_indexed:false});
  }
  return [...records.values()];
}
export function presidencyRecords(data){
  if(data.code!==200||!Array.isArray(data.data?.lista)||!Number.isSafeInteger(data.data.totalRecords))throw Error('PRESIDENCY_RESPONSE_INVALID');
  return data.data.lista.filter(r=>r.estado===true&&r.tipoDocumento?.nombre==='DECRETOS').map(r=>{
    if(!/^[a-f\d]{24}$/.test(r.id)||!/^\d{4}-\d{2}-\d{2}$/.test(r.fechaPromulgacion))throw Error('PRESIDENCY_RECORD_INVALID');
    const available=/^[a-f\d]{24}$/.test(r.normaDocumentoId);
    return {id:'presidencia-'+r.id,type:'Decreto',title:`Decreto ${r.nroNorma} · ${r.acapite}`,number:r.nroNorma.split('-')[0],year:r.fechaPromulgacion.slice(0,4),url:'https://decretos.presidencia.gov.py/api/norma/'+(available?'download/'+r.normaDocumentoId:'getById/'+r.id),source:'Presidencia de la República',source_url:'https://decretos.presidencia.gov.py/',date:r.fechaPromulgacion,normative_status:r.derogado,source_status:available?'ORIGINAL_LINKED':'ORIGINAL_UNAVAILABLE',notes:available?'Estado informado por Presidencia al recuperar el registro; requiere cotejo de relaciones normativas.':'Registro oficial sin archivo descargable; no se incorpora como texto consultado.',text_indexed:false};
  });
}
export function parseBacnText(html){
  const title=clean(/<h1\b[^>]*class=["']entry-title["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]??'');
  const section=/class=["']entry-content["'][^>]*>([\s\S]*?)<footer\b/i.exec(html)?.[1];
  if(!section)throw Error('LAW_BODY_NOT_FOUND');
  const body=clean(section.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,' '));
  if(body.length<200||!/(?:Art[íi]culo|Art\.)\s*\d+/i.test(body))throw Error('LAW_TEXT_UNAVAILABLE');
  const date=/Fecha de Promulgación:\s*(\d{2})-(\d{2})-(\d{4})/.exec(body);
  return {title,text:body,published_date:date?`${date[3]}-${date[2]}-${date[1]}`:null};
}
export function mefRecords(html){
  const records=[];
  for(const block of html.split(/<div class="list__item search-item">/).slice(1)){
    const title=clean(/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block)?.[1]??'');
    const description=clean(/<p[^>]*class="item__description"[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1]??'');
    const href=/href="([^"]+\.pdf)"/i.exec(block)?.[1];if(!href||!title)continue;
    const url=officialUrl(new URL(decode(href),'https://www.mef.gov.py').href);if(!url)continue;
    const number=/N[º°o.]*\s*([\d.]+)/i.exec(title)?.[1]?.replace(/\./g,'')??'';
    const fileNumber=/decreto\D*(\d+)/i.exec(decodeURIComponent(new URL(url).pathname.split('/').at(-1)))?.[1];
    const conflict=!!number&&!!fileNumber&&number!==fileNumber;
    records.push({id:'mef-'+sha(url).slice(0,20),type:'Decreto',number,year:/(20\d{2}|19\d{2})/.exec(title)?.[1]??'',title:title+' · '+description,url,source:'Ministerio de Economía y Finanzas',source_url:'https://www.mef.gov.py/es/marco-legal/decretos',date:'',notes:conflict?'Número del título y del archivo no coinciden. Texto excluido hasta cotejo.':'Publicación institucional; estado normativo pendiente de cotejo.',source_status:conflict?'METADATA_CONFLICT':'ORIGINAL_LINKED',text_indexed:false});
  }return records;
}
async function atomicJson(path,data){const tmp=path+'.next';await writeFile(tmp,JSON.stringify(data));await rename(tmp,path);}
export async function syncCorpus({root=ROOT,lawPages=30,presPages=3,jurLimit=200,perType=200,all=false,retryFailed=false}={}){
  const dir=resolve(root,'local-browser/library/research');await mkdir(resolve(dir,'originals'),{recursive:true});await mkdir(resolve(dir,'cache'),{recursive:true});await mkdir(resolve(dir,'texts'),{recursive:true});
  const db=new CorpusStore(resolve(dir,'corpus.sqlite'));
  const catalog=JSON.parse(await readFile(resolve(root,'apps/web/public/library/catalog.json'),'utf8'));
  const records=new Map(catalog.records.map(r=>[r.id,r]));const errors=[];let downloaded=0;
  const cached=async(url)=>{
    const path=resolve(dir,'cache',sha(url)+'.raw');const info=await stat(path).catch(()=>null);let bytes=info&&Date.now()-info.mtimeMs<86400000?await readFile(path):null;
    if(!bytes){const response=await officialGet(url,{maxBytes:5_000_000});bytes=response.bytes;await writeFile(path,bytes);downloaded+=bytes.length;}
    return bytes.toString('utf8');
  };
  const add=rows=>{for(const r of rows)records.set(r.id,{...records.get(r.id),...r});};
  try{
    // Import the previous seven texts without downloading or destroying their originals.
    const old=JSON.parse(await readFile(resolve(dir,'index.json'),'utf8').catch(()=>'{}'));
    for(const source of old.sources??[])if(!db.has(source.id)||source.id==='PY-CONSTITUCION')db.upsert({...source,content_format:'PDF',document_type:source.kind==='OFFICIAL_CASELAW'?'Jurisprudencia':source.id==='PY-CONSTITUCION'?'Constitución':'Código'});
    const popular=await cached('https://www.bacn.gov.py/leyes-paraguayas');add(bacnRecords(popular));
    for(let page=1;page<=lawPages;page++){
      try {const html=await cached(`https://www.bacn.gov.py/paginacion/leyes-paraguayas.php?action=ajax&page=${page}`);const rows=bacnRecords(html);add(rows);if(!rows.length)break;}
      catch(e){errors.push({stage:'BACN',page,reason:e.message});break;}
    }
    for(const acapite of ['REGLAMENTA',''])for(let page=0;page<presPages;page++){
      const params=new URLSearchParams({page:String(page),pageSize:'100',sortAsc:'false',sortField:'fechaPromulgacion',nroNorma:'',tipoDocumento:'DECRETOS',acapite,fechaElaboracion:'',fechaPromulgacionDesde:'',fechaPromulgacionHasta:'',derogado:'',presidente:'',oee:'',etiqueta:''});
      try {const data=JSON.parse(await cached('https://decretos.presidencia.gov.py/api/norma/?'+params));add(presidencyRecords(data));if((page+1)*100>=data.data.totalRecords)break;}
      catch(e){errors.push({stage:'PRESIDENCIA',page,reason:e.message});break;}
    }
    for(let page=0;page<8;page++){
      try{const html=await cached('https://www.mef.gov.py/es/marco-legal/decretos?page='+page);const rows=mefRecords(html);add(rows);if(!rows.length)break;}
      catch(e){errors.push({stage:'MEF',page,reason:e.message});break;}
    }
    console.log(JSON.stringify({discovered:records.size,already_indexed:db.coverage().sources.length}));
    const pending={Ley:0,Decreto:0,Jurisprudencia:0};let done=0;
    const queue=[...records.values()].filter(r=>['Ley','Decreto','Jurisprudencia'].includes(r.type)&&r.source_status!=='METADATA_CONFLICT'&&r.source_status!=='ORIGINAL_UNAVAILABLE'&&(r.type!=='Ley'||new URL(r.url).hostname==='www.bacn.gov.py')&&!db.has(r.id)&&(retryFailed||!db.status(r.id)||db.status(r.id)==='PENDING')&&officialUrl(r.url)&&(!r.year||Number(r.year)<=new Date().getUTCFullYear()));
    queue.sort((a,b)=>Number(/reglament|codigo|trabajo|niñez|comerci|datos|contratacion/i.test(b.title))-Number(/reglament|codigo|trabajo|niñez|comerci|datos|contratacion/i.test(a.title)));
    // Round-robin avoids a large legislation category starving jurisprudence or decrees.
    const groups=Object.fromEntries(Object.keys(pending).map(t=>[t,queue.filter(r=>r.type===t)]));
    const selected=[];for(let n=0;n<Math.max(...Object.values(groups).map(g=>g.length));n++)for(const type of Object.keys(pending)){
      if(groups[type][n]&&(all||pending[type]<(type==='Jurisprudencia'?jurLimit:perType))){selected.push(groups[type][n]);pending[type]++;}
    }
    for(const record of selected){
      if(downloaded>500_000_000&&!all){errors.push({stage:'BATCH_LIMIT',reason:'Límite de descarga del lote; los registros restantes quedan pendientes para la próxima ejecución.'});break;}
      try{
        const path=resolve(dir,'originals',record.id+'.raw');let bytes=await readFile(path).catch(()=>null);
        if(!bytes){const fetched=await officialGet(record.url);bytes=fetched.bytes;downloaded+=bytes.length;await writeFile(path,bytes,{flag:'wx'});}
        const originalHash=sha(bytes),isPdf=bytes.subarray(0,5).toString()==='%PDF-';let pages,published=record.date||null,title=record.title;
        if(isPdf){
          const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true,standardFontDataUrl:resolve(root,'phase2/tooling/node_modules/pdfjs-dist/standard_fonts').replace(/\\/g,'/')+'/'});
          try{const pdf=await task.promise;if(pdf.numPages>1500)throw Error('PAGE_LIMIT');pages=[];
            for(let page=1;page<=pdf.numPages;page++){const p=await pdf.getPage(page);const content=await p.getTextContent();pages.push({page,text:content.items.filter(i=>'str' in i).map(i=>i.str+(i.hasEOL?'\n':' ')).join('')});p.cleanup();}
          }finally{await task.destroy();}
          if(pages.reduce((n,p)=>n+p.text.trim().length,0)<200)throw Error('IMAGE_ONLY_NO_OCR');
        }else if(new URL(record.url).hostname==='www.bacn.gov.py'){
          const law=parseBacnText(bytes.toString('utf8'));pages=[{page:1,text:law.text}];published=law.published_date;title=law.title||title;
        }else throw Error('NO_SUPPORTED_FULL_TEXT');
        if(published&&!/^\d{4}-\d{2}-\d{2}$/.test(published))published=null;
        const source={id:record.id,title,url:record.url,publisher:record.source,kind:record.type==='Jurisprudencia'?'OFFICIAL_CASELAW':'LEGISLATION',document_type:record.type,publication_kind:record.type==='Jurisprudencia'?'Resolución publicada en repositorio oficial; identidad pendiente de cotejo':'Texto institucional; vigencia pendiente de cotejo',content_format:isPdf?'PDF':'HTML',published_date:published,normative_status:record.normative_status??null,original_sha256:originalHash,fetched_at:(await stat(path)).mtime.toISOString(),parser:isPdf?'Mozilla PDF.js '+version:'BACN bounded article-body parser',pages};
        await atomicJson(resolve(dir,'texts',record.id+'-'+originalHash+'.json'),source);db.upsert(source);records.set(record.id,{...record,text_indexed:true,title,date:published??record.date});done++;
      }catch(e){db.mark(record.id,e.message==='IMAGE_ONLY_NO_OCR'?'IMAGE_ONLY':'FAILED',e.message);errors.push({source_id:record.id,reason:e.message});}
      if((done+errors.length)%25===0)console.log(JSON.stringify({indexed_new:done,attempts:done+errors.length,downloaded_mb:Math.round(downloaded/1e6)}));
    }
    const coverage=db.coverage();
    for(const s of coverage.sources){const r=records.get(s.id);if(r)records.set(s.id,{...r,text_indexed:true});}
    catalog.records=[...records.values()];catalog.coverage={...catalog.coverage,junta_connected:true,full_text_search:true,full_text_scope:'Solo documentos con texto_indexado; no todos los títulos.',decrees_scope:'Registros recuperados del portal de Presidencia; cobertura parcial y reanudable.'};
    const report={...coverage,discovered_records:records.size,selected_for_batch:selected.length,indexed_new:done,downloaded_bytes:downloaded,errors,paid_calls:0,deployments:0,engine:'SQLITE_FTS5_BM25',complete_library_indexed:catalog.records.every(r=>r.text_indexed===true)};
    await atomicJson(resolve(root,'apps/web/public/library/catalog.json'),catalog);
    await atomicJson(resolve(root,'apps/web/public/library/research-coverage.json'),report);
    await atomicJson(resolve(dir,'last-sync.json'),report);
    console.log(JSON.stringify({indexed_total:coverage.sources.length,indexed_new:done,passages:coverage.passages,failures:errors.length}));return report;
  }finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const all=process.argv.includes('--all');await syncCorpus({...all?{all:true,lawPages:713,presPages:364}:{},retryFailed:process.argv.includes('--retry-failed')});
}
