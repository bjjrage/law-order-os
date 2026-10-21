import { readFile,stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {CorpusStore} from './library-corpus-store.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hosts = new Set(['www.pj.gov.py','csj.gov.py','www.csj.gov.py','cultura.gov.py','www.conatel.gov.py','correoparaguayo.gov.py','digestolegislativo.gov.py','silpy.congreso.gov.py','www.bacn.gov.py','decretos.presidencia.gov.py','www.mef.gov.py']);
export function officialUrl(value) {
  try { const u = new URL(value); return u.protocol==='https:' && hosts.has(u.hostname) && !u.username && !u.password && !u.port ? u.href : null; } catch { return null; }
}
const normal = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stop = new Set('para como solo sobre este esta estos estas entre desde hasta tiene tienen falta faltan revisar revision evaluar documento documentos documentacion seleccionados seleccionado asunto caso consulta cuestion concreto concreta sintetico sintetica prueba partes parte puedo puede pueden deber debe deben dar sin por con una uno unos unas del las los que sus ser hacer analizar determinar indicar indicado indicada disponible disponibles codigo ley leyes jurisprudencia fecha fechas texto informacion resultado relacion relacionar'.split(' '));
const terms = s => normal(s).match(/[a-z0-9]{3,}/g)?.map(t=>t.endsWith('es')&&t.length>6?t.slice(0,-2):t.endsWith('s')&&t.length>5?t.slice(0,-1):t).filter(t=>!stop.has(t))??[];
export function retrievalTerms(question,scope='',documents=''){
  return [...new Set([...terms(question),...terms(scope),...terms(documents).slice(0,12)])];
}
export function searchResearch(index, catalog, question, scope='', documents='', asOf='9999-12-31') {
  const query = new Map();
  for(const [text,weight] of [[question,4],[scope,1],[documents,.3]]) for(const t of new Set(terms(text))) query.set(t,(query.get(t)??0)+weight);
  // Retrieval vocabulary only; these expansions make no statement about the applicable law.
  for(const [pattern,words] of [[/contrat|clausul|preavis|finaliz|rescisi/,'contrato rescisión resolución obligación aviso notificación'],[/despid|laboral|trabaj/,'trabajo despido empleador trabajador'],[/alimen|divorci|matrimoni/,'alimentos divorcio familia matrimonio']])
    if(pattern.test(normal(question))) for(const t of terms(words)) query.set(t,Math.max(query.get(t)??0,1));
  const focus=normal(question+' '+scope+' '+documents);
  const requested=/(ley|decreto)\s*(?:n[º°o.]?\s*)?(\d{3,})/i.exec(normal(question));
  const identifierMatches=s=>!requested||(new RegExp('(?:^|[^0-9])'+requested[2]+'(?:[^0-9]|$)').test(normal(s.title+' '+s.url))&&(requested[1]!=='decreto'||s.document_type==='Decreto'||/decreto/.test(normal(s.title))));
  const contract=/contrat|preavis|rescisi/.test(focus)&&!/laboral|despido|imputad|penal/.test(normal(question+' '+scope));
  const publicContract=/licitacion|contratacion publica|administrativ|\bpublic[oa]\b/.test(focus);
  const servicesContract=contract&&/servicio|mantenimiento/.test(focus);
  const sources=(index?.sources??[]).filter(s=>officialUrl(s.url)&&identifierMatches(s)&&(!s.published_date||s.published_date<=asOf));
  const chunks=[];
  for(const source of sources) for(const page of source.pages) {
    if(contract&&!publicContract&&/presupuesto general|funcion publica|contrataciones publicas/.test(normal(source.title)))continue;
    if(contract&&source.kind==='LEGISLATION'&&/penal|constituci/i.test(source.title))continue;
    if(contract&&source.id==='PY-CPC-CORREO'&&!/procesal|demanda|juicio|apelaci|arbitraje/.test(normal(question+' '+scope)))continue;
    const text=page.text.replace(/\s+/g,' ').trim();
    for(let start=0;start<text.length;start+=page.passage_id?text.length:1000) {
      const excerpt=text.slice(start,start+1300); if(excerpt.length<60)continue;
      const n=normal(excerpt);
      if(/c\s*ontenido|i\s*ndice general/.test(n)&&page.page<20)continue;
      if(contract&&(!/contrat/.test(n)||(!publicContract&&/contratista|cgc|licitacion|fondos de reparo|gobernacion/.test(n))))continue;
      if(contract&&!/seguro|asegurador|mandato/.test(focus)&&/asegurador|siniestro|mandatario/.test(n))continue;
      if(contract&&!/banc|cuenta corriente/.test(focus)&&/depositos bancarios|cuenta corriente|banco/.test(n))continue;
      if(servicesContract&&source.kind==='OFFICIAL_CASELAW'&&!/servicio/.test(normal(source.pages.filter(p=>Math.abs(p.page-page.page)<=1).map(p=>p.text).join(' '))))continue;
      const tokens=new Set(terms(excerpt));const matches=[...query.keys()].filter(t=>tokens.has(t));
      const exactNumber=/(?:ley|decreto)\s*(?:n[º°o.]?\s*)?(\d{3,})/i.exec(normal(question))?.[1];
      const numberMatch=exactNumber&&new RegExp('\\b'+exactNumber+'\\b').test(normal(source.title));
      if(matches.length>=2||numberMatch)chunks.push({source,page:page.page,start:page.start??start,passage_id:page.passage_id,locator:page.locator,text:excerpt,matches,focusBoost:(numberMatch?100:0)+(contract?(/rescisi|resolucion del contrato/.test(n)?20:0)+(/prestacion de servicio|contrato de servicio/.test(n)?35:0)+(/preaviso|aviso previo/.test(n)?8:0):0)});
    }
  }
  const df=new Map();for(const c of chunks)for(const t of c.matches)df.set(t,(df.get(t)??0)+1);
  for(const c of chunks)c.score=c.focusBoost+c.matches.reduce((n,t)=>n+query.get(t)*Math.log(1+chunks.length/(df.get(t)??1)),0);
  chunks.sort((a,b)=>b.score-a.score||a.source.id.localeCompare(b.source.id)||a.page-b.page||a.start-b.start);
  const picked=[];
  for(const kind of ['LEGISLATION','OFFICIAL_CASELAW']) {
    const groups=new Map();
    for(const c of chunks.filter(c=>c.source.kind===kind)){
      if(groups.size>=3&&!groups.has(c.source.id))continue;
      const selected=groups.get(c.source.id)??[];
      if(selected.length<2&&!selected.some(e=>e.page===c.page&&Math.abs(e.start-c.start)<1300))selected.push(c);
      groups.set(c.source.id,selected);
    }
    for(const [id,selected] of groups) { const s=selected[0].source; picked.push({source_id:id,kind:s.kind,title:s.title.length>1800?s.title.slice(0,1799)+String.fromCharCode(8230):s.title,url:s.url,publisher:s.publisher,publication_kind:s.publication_kind,...(s.content_format?{content_format:s.content_format}:{}),...(s.document_type?{document_type:s.document_type}:{}),...(s.normative_status?{normative_status:s.normative_status}:{}),original_sha256:s.original_sha256,version_id:s.original_sha256,fetched_at:s.fetched_at,extraction_status:s.extraction_status??'DIGITAL_TEXT_UNREVIEWED',...(s.extraction_sha256?{extraction_sha256:s.extraction_sha256}:{}),...(s.ocr?.unreadable_pages?.length?{unreadable_pages:s.ocr.unreadable_pages}:{}),verification:'REQUIRES_LEGAL_REVIEW',excerpts:selected.map(c=>({passage_id:c.passage_id??`${id}:p${c.page}:${c.start}`,page:c.page,text:c.text,...(c.locator?{locator:c.locator}:{})})),use:'NOT_SUPPLIED'}); }
  }
  const located=(catalog?.records??[]).filter(r=>officialUrl(r.url)&&identifierMatches(r)&&!picked.some(p=>p.url===r.url)&&(!r.year||Number(r.year)<=Number(asOf.slice(0,4)))&&(!contract||publicContract||!/prestamo|salud|presupuesto|contratacion publica/.test(normal(r.title)))).map(r=>({...r,hits:terms(r.title).filter(t=>query.has(t))})).filter(r=>new Set(r.hits).size>=2).sort((a,b)=>b.hits.length-a.hits.length||a.id.localeCompare(b.id)).slice(0,5).map(r=>({source_id:r.id,title:r.title,url:r.url,kind:r.type==='Jurisprudencia'?'OFFICIAL_CASELAW':'LEGISLATION',use:'LOCATED_ONLY'}));
  const limitations=['Búsqueda local en textos recuperados y títulos del catálogo; cobertura parcial. No certifica vigencia ni reemplaza el cotejo del abogado.','Los compendios judiciales son publicaciones de la Corte; no se presentan como el original íntegro de cada sentencia.'];
  if(!picked.some(s=>s.kind==='OFFICIAL_CASELAW'))limitations.push('No se encontró jurisprudencia con texto pertinente en el conjunto disponible.');
  if(!picked.some(s=>s.kind==='LEGISLATION'))limitations.push('No se encontró legislación con texto pertinente en el conjunto disponible.');
  return {searched_at:new Date().toISOString(),as_of_date:asOf,indexed_sources:sources.length,catalog_records:catalog?.records?.length??0,sources:picked,located,limitations};
}
export async function researchCase(root,question,scope,documents,asOf) {
  const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
  let db;
  const corpusPath=resolve(root,'local-browser/library/research/corpus.sqlite');
  if(await stat(corpusPath).catch(()=>null)){
  try{
    db=new CorpusStore(corpusPath,{readOnly:true});
    const candidates=db.candidates(retrievalTerms(question,scope,documents),asOf);
    const catalog={records:db.located(retrievalTerms(question,scope,documents))};
    const result=searchResearch(candidates,catalog,question,scope,documents,asOf);
    result.indexed_sources=Number(db.db.prepare('SELECT count(*) AS n FROM sources').get().n);
    result.catalog_records=Number(db.db.prepare('SELECT count(*) AS n FROM library_records').get().n);
    result.retrieval={engine:'SQLITE_FTS5_BM25',candidate_sources:candidates.sources.length,passages_in_index:Number(db.db.prepare('SELECT count(*) AS n FROM passages_docsize').get().n)};
    return result;
  }catch(e){throw Object.assign(Error('LIBRARY_SEARCH_UNAVAILABLE'),{code:'LIBRARY_SEARCH_UNAVAILABLE',cause:e});}
  finally{db?.close();}
  }
  const [index,catalog]=await Promise.all([read('local-browser/library/research/index.json').catch(()=>null),read('apps/web/public/library/catalog.json').catch(()=>null)]);
  const result=searchResearch(index,catalog,question,scope,documents,asOf);
  if(!index)result.limitations.unshift('El índice de textos oficiales no está disponible; se buscaron únicamente referencias del catálogo.');
  return result;
}
export function researchContext(research) {
  if(!research)return undefined;
  return {as_of_date:research.as_of_date,limitations:research.limitations,sources:research.sources.map(({use,...s})=>s)};
}
export function researchUsage(research,run) {
  if(!research)return undefined;
  const received=run?.stages?.some(s=>s.stage_name==='PRINCIPAL_ANALYSIS'&&s.status==='PASS');
  const refs=run?.analysis?.supporting_references??[];
  return {...research,sources:research.sources.map(s=>{
    const citations=refs.filter(r=>r.source_id===s.source_id&&r.document_version_id===s.version_id).map(r=>{
      const e=s.excerpts.find(e=>e.passage_id===r.passage_id);
      return {reference:r.raw_text??'',quote:r.quote,page:e?.page??null,quote_match:r.quote===null?null:!!r.quote.trim()&&!!e&&e.text.replace(/\s+/g,' ').includes(r.quote.replace(/\s+/g,' ').trim())};
    });
    return {...s,citations,use:received?(citations.length?'CITED':'PROVIDED'):'NOT_SUPPLIED'};
  })};
}
