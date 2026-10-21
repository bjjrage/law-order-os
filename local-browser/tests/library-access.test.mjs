import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {CorpusStore,sha} from '../../scripts/library-corpus-store.mjs';
import {libraryCoverage,libraryDocument,libraryOriginal} from '../../scripts/library-access.mjs';
import {queryCatalog} from '../../scripts/library-catalog.mjs';
import {libraryJobStatus} from '../../scripts/library-job.mjs';

it('opens indexed texts and hash-checked local originals despite broken display snapshots, without any download',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'law-order-access-'));let db;
  try{
    const dir=resolve(root,'local-browser/library/research');await mkdir(resolve(dir,'originals'),{recursive:true});await mkdir(resolve(dir,'texts'));
    db=new CorpusStore(resolve(dir,'corpus.sqlite'));
    const bytes=Buffer.from('%PDF-FAKE ONLY FOR TEST'),hash=sha(bytes);
    const source={id:'local-law',title:'Ley de prueba local',url:'https://www.bacn.gov.py/leyes-paraguayas/1',publisher:'TEST',document_type:'Ley',content_format:'PDF',original_sha256:hash,pages:[{page:1,text:'TEXTO FICTICIO para verificar que el documento guardado se puede leer sin consultar un portal externo. '.repeat(4)}]};
    db.upsert(source);db.register([{id:source.id,title:source.title,type:'Ley',year:'2025'}, {id:'pending',title:'Referencia sin texto',type:'Ley',year:'2025'}]);
    await writeFile(resolve(dir,'texts',`${source.id}-${hash}-${sha(JSON.stringify(source.pages))}.json`),JSON.stringify(source));
    await writeFile(resolve(dir,'originals',source.id+'.raw'),bytes);
    await writeFile(resolve(dir,'full-load-progress.json'),Buffer.alloc(20));
    expect(libraryCoverage(root)).toMatchObject({indexed_sources:1,discovered_records:2,passages:1});
    expect(await libraryJobStatus(root)).toMatchObject({status:'INTERRUPTED',indexed_documents:1,indexed_passages:1});
    await writeFile(resolve(dir,'full-load-progress.json'),JSON.stringify({status:'RUNNING',pid:process.pid}));
    // A live PID that belongs to another program is not an active library job.
    expect(await libraryJobStatus(root,{isRunning:async()=>false})).toMatchObject({status:'INTERRUPTED',indexed_documents:1});
    expect(queryCatalog(root,{indexedOnly:true})).toMatchObject({total:1});
    expect(queryCatalog(root)).toMatchObject({total:2});
    const doc=await libraryDocument(root,source.id);expect(doc).toMatchObject({title:source.title,original_available:true,next_offset:null});expect(doc.passages[0].text).toContain('TEXTO FICTICIO');
    expect((await libraryOriginal(root,source.id)).bytes).toEqual(bytes);
    await writeFile(resolve(dir,'originals',source.id+'.raw'),'damaged');
    await expect(libraryOriginal(root,source.id)).rejects.toThrow('LIBRARY_ORIGINAL_UNAVAILABLE');
    await expect(libraryDocument(root,'../../.env')).rejects.toThrow('LIBRARY_DOCUMENT_ID_INVALID');
    await expect(libraryDocument(root,'pending')).rejects.toThrow('LIBRARY_DOCUMENT_NOT_INDEXED');
    await expect(libraryDocument(root,source.id,-1)).rejects.toThrow('LIBRARY_DOCUMENT_OFFSET_INVALID');
    // Text remains readable after a damaged source-file cache.
    await writeFile(resolve(dir,'texts',`${source.id}-${hash}-${sha(JSON.stringify(source.pages))}.json`),'damaged');
    expect((await libraryDocument(root,source.id)).passages[0].text).toContain('TEXTO FICTICIO');
  }finally{db?.close();if(!resolve(root).startsWith(resolve(tmpdir())+sep+'law-order-access-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}
});
