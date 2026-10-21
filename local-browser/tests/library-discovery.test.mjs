import {expect,it} from 'vitest';
import {acordadaRecords,csjRecords,judicialRecords,judicialYears} from '../../scripts/library-discovery.mjs';
import {CorpusStore} from '../../scripts/library-corpus-store.mjs';
import {libraryJobStatus,ensureLibraryJob} from '../../scripts/library-job.mjs';
import {queryCatalog} from '../../scripts/library-catalog.mjs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
it('discovers acordadas, official law-detail pages and recent court decisions without converting metadata into read text',()=>{
 const a=acordadaRecords('<tr><td>1718</td><td data-order="2023-08-09">09/08/2023</td><td>Cobertura de gastos</td><td>Capital</td><td><a href="/images/contenido/acordadas/acordada1718.pdf">PDF</a></td></tr>');expect(a[0]).toMatchObject({type:'Acordada',date:'2023-08-09',text_indexed:false});
 const c=csjRecords('<div class="list-item box" id="16656"><p class="title">Decreto 3594</p><p class="desc">TEST ONLY</p><script>',2025);expect(c[0]).toMatchObject({id:'csj-norma-16656',source_status:'DETAIL_PAGE',text_indexed:false});
 const r=judicialRecords({recordsFiltered:1,data:[{CodigoJurisprudencia:108259,NoResolucionJudicial:20,FechaResolucionJudicial:'/Date(1738551600000)/',TipoResolucionJudicial:{DescripcionTipoResolucionJudicial:'Auto Interlocutorio'},Sala:{DescripcionSala:'SALA PENAL'},CaratulaPublicacion:'SYNTHETIC TEST',TieneDocumento:true}]});expect(r[0]).toMatchObject({id:'csj-juris-108259',year:'2025',type:'Jurisprudencia',text_indexed:false});
 expect(judicialYears('<select id="Anno"><option value="2026">2026</option><option value="1993">1993</option></select>')).toEqual([2026,1993]);
 expect(()=>judicialYears('<html>Error temporal</html>')).toThrow('JUDICIAL_YEARS_UNAVAILABLE');
});
it('searches the paged catalog through FTS, records resumable discovery state and never starts a worker without local authorization',async()=>{
 const processCheck={isRunning:async pid=>pid===process.pid};
 const root=await mkdtemp(resolve(tmpdir(),'law-order-catalog-'));let db;
 try{
  const dir=resolve(root,'local-browser/library/research');await mkdir(dir,{recursive:true});db=new CorpusStore(resolve(dir,'corpus.sqlite'));
  const rows=Array.from({length:70},(_,i)=>({id:'test-'+i,type:'Ley',year:'2025',title:'Ley contratos '+i,url:'https://www.bacn.gov.py/leyes-paraguayas/'+i,source:'TEST',notes:'TEST',text_indexed:false}));db.register(rows);db.register(rows);
  expect(queryCatalog(root,{query:'contrato',page:2}).records).toHaveLength(20);expect(queryCatalog(root,{query:'contrato'}).total).toBe(70);expect(queryCatalog(root,{query:'DROP TABLE fuentes'}).records).toHaveLength(0);
  db.state('discover:BACN',{next:10,complete:false});expect(db.state('discover:BACN').next).toBe(10);
  expect((await ensureLibraryJob(root)).status).toBe('DISABLED');
  await writeFile(resolve(dir,'full-load-progress.json'),JSON.stringify({status:'RUNNING',pid:2147483647,indexed_documents:70}));expect((await libraryJobStatus(root,processCheck)).status).toBe('INTERRUPTED');
  await writeFile(resolve(dir,'full-load-progress.json'),JSON.stringify({status:'COMPLETED_AVAILABLE_QUEUE',indexed_documents:70,updated_at:'2026-10-14T01:00:00Z'}));
  await writeFile(resolve(dir,'ocr-load-progress.json'),JSON.stringify({status:'RUNNING',pid:process.pid,indexed_documents:71,updated_at:'2026-10-14T02:00:00Z',current_document:{title:'Escaneo pendiente',reading_scan:true,page:3,total_pages:12}}));
  expect(await libraryJobStatus(root,processCheck)).toMatchObject({status:'RUNNING',indexed_documents:71,current_document:{page:3},ocr:{status:'RUNNING'}});
  await mkdir(resolve(root,'.local-dev'),{recursive:true});await writeFile(resolve(root,'.local-dev/library-full-load.json'),JSON.stringify({enabled:true,ocr:true,paid_calls:false}));
  expect(await ensureLibraryJob(root,processCheck)).toMatchObject({status:'RUNNING',indexed_documents:71});
  await writeFile(resolve(dir,'ocr-load-progress.json'),JSON.stringify({status:'COMPLETED_AVAILABLE_QUEUE',indexed_documents:72,updated_at:'2026-10-14T03:00:00Z'}));
  expect(await libraryJobStatus(root)).toMatchObject({status:'COMPLETED_AVAILABLE_QUEUE',indexed_documents:72});
  expect(await ensureLibraryJob(root)).toMatchObject({status:'COMPLETED_AVAILABLE_QUEUE'});
 }finally{db?.close();if(!resolve(root).startsWith(resolve(tmpdir())+sep+'law-order-catalog-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}
});
