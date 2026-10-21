import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const rawRoot='local-browser/library';
const publicRoot='apps/web/public/library';
export const clean = s => String(s ?? '').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|ordm|deg|amp|quot|aacute|eacute|iacute|oacute|uacute|ntilde);/g,m=>({'&nbsp;':' ','&ordm;':'º','&deg;':'°','&amp;':'&','&quot;':'"','&aacute;':'á','&eacute;':'é','&iacute;':'í','&oacute;':'ó','&uacute;':'ú','&ntilde;':'ñ'}[m])).replace(/\s+/g,' ').trim();
export function safeOfficialUrl(value, hosts) {
  try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&hosts.includes(u.hostname)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function lawRecords(data) {
  if(data.codigoEstado!==200 || !Array.isArray(data.datos)) throw Error('CONGRESS_RESPONSE_INVALID');
  return data.datos.map(d=>{
    const url=safeOfficialUrl(d.appURL,['silpy.congreso.gov.py']);
    if(!Number.isSafeInteger(d.idLey)||d.idLey<=0||!d.numeroLey||!url)throw Error('CONGRESS_RECORD_INVALID');
    const date=String(d.fechaPromulgacion??'');
    const year=/^\d{2}\/\d{2}\/(19\d{2}|20\d{2})$/.exec(date)?.[1]??'';
    return {id:'congreso-ley-'+d.idLey,type:'Ley',number:String(d.numeroLey),year,title:clean(d.proyecto?.acapite)||'Ley '+d.numeroLey,url,source:'Congreso Nacional · SILpy',source_url:'https://datosv2.congreso.gov.py/web/api/ley',date,notes:!year&&date?'Fecha de origen inconsistente; requiere cotejo.':'Título descriptivo del expediente legislativo; cotejar texto sancionado.',text_indexed:false};
  });
}
export function jurisprudenceRecords(html) {
  const rows=[];const seen=new Set();
  for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
    const title=clean(m[2]),url=safeOfficialUrl(clean(m[1]),['digestolegislativo.gov.py']);
    if(!url||!new URL(url).pathname.toLowerCase().endsWith('.pdf')||!/(?:sentencia|acuerdo)/i.test(title)||seen.has(url))continue;
    seen.add(url);
    rows.push({id:'digesto-'+createHash('sha256').update(url).digest('hex').slice(0,20),type:'Jurisprudencia',number:/N[º°o.]?\s*(\d+)/i.exec(title)?.[1]??'',year:/\b(19\d{2}|20\d{2})\b/.exec(title)?.[1]??'',title,url,source:'Senado · Digesto Legislativo',source_url:'https://digestolegislativo.gov.py/pagina&id=39',date:'',notes:'Referencia publicada en índice oficial. Sala, texto y estado del PDF pendientes de cotejo individual.',text_indexed:false});
  }
  return rows;
}
export async function syncLibrary(){
  await mkdir(rawRoot,{recursive:true});await mkdir(publicRoot,{recursive:true});
  const records=new Map(),pages=[];let complete=false;
  for(let page=1;page<=40;page++){
    const url=`https://datosv2.congreso.gov.py/web/api/ley?offset=${page}&limit=500`;
    const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('CONGRESS_HTTP_'+r.status);
    const bytes=await r.text(),data=JSON.parse(bytes),rows=lawRecords(data);
    await writeFile(`${rawRoot}/ley-page-${page}.json`,bytes);
    pages.push({page,url,count:rows.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    const before=records.size;for(const row of rows)records.set(row.id,row);
    console.log(`Congreso: página ${page}, ${records.size} leyes distintas`);
    if(rows.length<500){complete=true;break;}
    if(records.size===before)throw Error('CONGRESS_REPEATED_PAGE');
  }
  const jurUrl='https://digestolegislativo.gov.py/pagina&id=39';
  const jr=await fetch(jurUrl,{signal:AbortSignal.timeout(25000)});if(!jr.ok)throw Error('DIGESTO_HTTP_'+jr.status);
  const html=await jr.text();await writeFile(`${rawRoot}/digesto-jur.html`,html);
  for(const row of jurisprudenceRecords(html))records.set(row.id,row);
  const catalog=JSON.parse(await readFile('docs/fuentes/FUENTES_Y_APIS_PARAGUAY_v1.1.json','utf8'));
  for(const source of catalog.sources.filter(s=>['PY-CONSTITUCION','PY-CC-CONATEL','PY-CPP-IIJ','PY-CP-IIJ','PY-CPC-CORREO'].includes(s.id))){
    records.set(source.id,{id:source.id,type:source.id==='PY-CONSTITUCION'?'Constitución':'Código',number:'',year:'',title:source.name,url:source.sample??source.url,source:source.institution,source_url:source.url,date:'',notes:source.coverage,text_indexed:false});
  }
  const previous=JSON.parse(await readFile(publicRoot+'/catalog.json','utf8').catch(()=>'{}'));
  for(const r of previous.records??[])if(!records.has(r.id))records.set(r.id,r);
  const coverage=JSON.parse(await readFile(publicRoot+'/research-coverage.json','utf8').catch(()=>'{}'));
  const indexed=new Set((coverage.sources??[]).map(s=>s.id));
  for(const [id,r] of records)records.set(id,{...r,text_indexed:indexed.has(id)});
  const output={schema_version:1,fetched_at:new Date().toISOString(),coverage:{laws_pagination_exhausted:complete,laws_scope:'Registros devueltos por API Congreso v2; no certifica todas las leyes históricas ni vigencia.',jurisprudence_scope:'PDFs enlazados en una página del índice Digesto; cobertura parcial, no todas las salas/años.',decrees_scope:'Sin catálogo de decretos integrado; acceso al buscador oficial CSJ en Fuentes.',full_text_search:indexed.size>0,junta_connected:true},records:[...records.values()],provenance:{law_pages:pages,jurisprudence_index:{url:jurUrl,sha256:createHash('sha256').update(html).digest('hex')}}};
  if([...records.values()].some(r=>r.type==='Decreto'))output.coverage.decrees_scope='Presidencia y MEF; cobertura parcial, textos disponibles identificados por registro.';
  await writeFile(`${publicRoot}/catalog.json`,JSON.stringify(output));
  console.log(JSON.stringify({count:output.records.length,types:output.records.reduce((a,r)=>(a[r.type]=(a[r.type]??0)+1,a),{}),complete}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await syncLibrary();
