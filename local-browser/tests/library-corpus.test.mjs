import {expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {CorpusStore} from '../../scripts/library-corpus-store.mjs';
import {officialGet,presidencyRecords,bacnRecords,parseBacnText,mefRecords} from '../../scripts/library-corpus-ingest.mjs';
import {researchCase,researchContext} from '../../scripts/library-research.mjs';
import {LibraryResearchSchema} from '../../dist/providers/contracts.js';
import {sourceLocation} from '../../apps/web/src/junta-sources.ts';
const base={id:'decreto-test',title:'Decreto 4777 · Régimen de empleo público',url:'https://decretos.presidencia.gov.py/api/norma/download/abc',publisher:'FUENTE SINTÉTICA DE TEST',kind:'LEGISLATION',document_type:'Decreto',content_format:'PDF',publication_kind:'TEST ONLY',published_date:'2025-10-01',original_sha256:'a'.repeat(64),fetched_at:'2026-10-14T00:00:00.000Z',pages:[{page:4,text:'El contrato de empleo público y la notificación de su finalización requieren revisar el régimen reglamentario. TEXTO FICTICIO EXCLUSIVO PARA PRUEBAS.'}]};
it('uses the real persistent full-text index, preserves locators, excludes future text and removes superseded passages',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'law-order-rag-'));let db;
 try{
  const dir=resolve(root,'local-browser/library/research');await mkdir(dir,{recursive:true});db=new CorpusStore(resolve(dir,'corpus.sqlite'));
  db.upsert(base);db.upsert({...base,id:'future',published_date:'2027-01-01'});
  const hits=db.candidates(['empleo','notificación'],'2026-10-14');expect(hits.sources.map(s=>s.id)).toEqual([base.id]);
  db.mark('scan','IMAGE_ONLY','IMAGE_ONLY_NO_OCR');expect(db.coverage().sources).toHaveLength(2);expect(db.coverage().statuses.IMAGE_ONLY).toBe(1);
  const r=await researchCase(root,'Decreto 4777 sobre contrato de empleo público','','','2026-10-14');
  expect(r.retrieval.engine).toBe('SQLITE_FTS5_BM25');expect(r.sources[0].document_type).toBe('Decreto');expect(r.sources[0].excerpts[0]).toMatchObject({passage_id:'decreto-test:p4:0',page:4});
  expect(LibraryResearchSchema.parse(researchContext(r)).sources).toHaveLength(1);
  const absent=await researchCase(root,'Decreto 9999 contrato empleo público','','','2026-10-14');expect(absent.sources).toHaveLength(0);
  db.upsert({...base,original_sha256:'b'.repeat(64),pages:[{page:6,text:'NUEVA VERSIÓN. La protección de datos personales y privacidad en redes informáticas. Texto ficticio de prueba de reemplazo de versión.'}]});
  expect(db.candidates(['notificación'],'2026-10-14').sources).toHaveLength(0);
  expect(db.db.prepare('SELECT count(*) AS n FROM versions WHERE id=?').get(base.id).n).toBe(2);
  db.close();db=null;await writeFile(resolve(dir,'corpus.sqlite'),'CORRUPT SYNTHETIC DATABASE');
  await expect(researchCase(root,'Contrato y notificación','','','2026-10-14')).rejects.toThrow('LIBRARY_SEARCH_UNAVAILABLE');
 }finally{db?.close();if(!resolve(root).startsWith(resolve(tmpdir())+sep+'law-order-rag-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}
});
it('parses actual law bodies, avoids indexing navigation or list excerpts and labels HTML by article rather than fictitious PDF pages',()=>{
 const text='Artículo 9. '+('La notificación del contrato de empleo. '.repeat(12));
 const law=parseBacnText('<h1 class="entry-title">Ley 123 · Contratos</h1><nav>SECRET NAVIGATION</nav><div class="entry-content">Fecha de Promulgación: 01-02-2025<div>'+text+'</div><footer>DO NOT INDEX</footer>');
 expect(law.text).not.toContain('SECRET NAVIGATION');expect(law.text).not.toContain('DO NOT INDEX');expect(law.published_date).toBe('2025-02-01');
 expect(()=>parseBacnText('<article>Listado Artículo 9</article>')).toThrow('LAW_BODY_NOT_FOUND');
 expect(sourceLocation({content_format:'HTML'},{page:1,locator:'Artículo 9'})).toBe('Artículo 9');
 const records=bacnRecords('<a href="https://www.bacn.gov.py/leyes-paraguayas/123/ley-123">Ley Nº 123/2025 sobre contratos</a>');expect(records[0]).toMatchObject({id:'bacn-123',year:'2025',text_indexed:false});
});
it('retains decree records without an attached original and flags conflicting decree metadata',()=>{
 const row={id:'a'.repeat(24),normaDocumentoId:null,fechaPromulgacion:'2025-10-01',estado:true,nroNorma:'4777-2025',tipoDocumento:{nombre:'DECRETOS'},acapite:'TEST ONLY'};
 expect(presidencyRecords({code:200,data:{lista:[row],totalRecords:1}})[0].source_status).toBe('ORIGINAL_UNAVAILABLE');
 const r=mefRecords('<div class="list__item search-item"><h3>Decreto N° 6014/2026</h3><p class="item__description">SYNTHETIC</p><a href="/sites/default/files/decreto_6104_2026.pdf">PDF</a></div>');
 expect(r[0].source_status).toBe('METADATA_CONFLICT');
});
it('bounds official downloads, blocks unsafe redirects and never sends authentication or model requests',async()=>{
 const transport=vi.fn(async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1:9999/private'}}));
 await expect(officialGet('https://www.bacn.gov.py/leyes-paraguayas',{transport})).rejects.toThrow('UNSAFE_REDIRECT');expect(transport).toHaveBeenCalledTimes(1);
 expect(transport.mock.calls[0][1]).toMatchObject({method:'GET',redirect:'manual'});expect(transport.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
 const large=vi.fn(async()=>new Response('123456789',{headers:{'content-length':'9'}}));await expect(officialGet('https://www.mef.gov.py/test.pdf',{transport:large,maxBytes:5})).rejects.toThrow('SOURCE_TOO_LARGE');
 await expect(officialGet('https://evil.example/test.pdf',{transport})).rejects.toThrow('OFFICIAL_URL_REQUIRED');expect(transport).toHaveBeenCalledTimes(1);
});
