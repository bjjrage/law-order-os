import { resolve } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { CorpusStore, sha, chunksOf } from './library-corpus-store.mjs';
import { officialUrl } from './library-research.mjs';

const summaries = new Map();
export function libraryCoverage(root) {
  const path = resolve(root, 'local-browser/library/research/corpus.sqlite');
  const cached = summaries.get(path);
  if (cached && Date.now() - cached.at < 15000) return cached.value;
  const db = new CorpusStore(path, { readOnly: true });
  try {
    const counts = db.db.prepare('SELECT count(*) documents,coalesce(sum(page_count),0) pages FROM sources').get();
    const value = {
      schema_version: 3, updated_at: new Date().toISOString(),
      indexed_sources: Number(counts.documents), page_count: Number(counts.pages),
      discovered_records: Number(db.db.prepare('SELECT count(*) n FROM library_records').get().n),
      passages: Number(db.db.prepare('SELECT count(*) n FROM passages_docsize').get().n),
      statuses: Object.fromEntries(db.db.prepare('SELECT status,count(*) n FROM ingestion GROUP BY status').all().map(r => [r.status, Number(r.n)])),
      sources: db.db.prepare('SELECT id,metadata,page_count FROM sources ORDER BY id LIMIT 15').all().map(r => ({ ...JSON.parse(r.metadata), page_count: Number(r.page_count) })),
      engine: 'SQLITE_FTS5_BM25', complete_library_indexed: false,
    };
    if (summaries.size > 8) summaries.clear();
    summaries.set(path, { at: Date.now(), value });
    return value;
  } finally { db.close(); }
}

function validId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,220}$/.test(id)) throw Error('LIBRARY_DOCUMENT_ID_INVALID');
}
function originalPaths(root,id,hash){
  if(!/^[a-f0-9]{64}$/.test(hash??''))throw Error('LIBRARY_ORIGINAL_UNAVAILABLE');
  const dir=resolve(root,'local-browser/library/research/originals');
  return [id+'.attachment.raw',id+'.raw',id+'.pdf',hash+'.pdf'].map(name=>resolve(dir,name));
}
function libraryMetadata(root, id) {
  validId(id);
  const db = new CorpusStore(resolve(root, 'local-browser/library/research/corpus.sqlite'), { readOnly: true });
  try {
    const source = db.db.prepare('SELECT metadata,page_count,version,extraction_hash FROM sources WHERE id=?').get(id);
    if (!source) throw Error('LIBRARY_DOCUMENT_NOT_INDEXED');
    return {...source, metadata: JSON.parse(source.metadata)};
  } finally { db.close(); }
}
export async function libraryDocument(root, id, offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw Error('LIBRARY_DOCUMENT_OFFSET_INVALID');
  const source=libraryMetadata(root,id),meta=source.metadata;
  let rows;
  for(const name of [`${id}-${source.version}-${source.extraction_hash}.json`,`${id}-${source.version}.json`]){
    try{
      const saved=JSON.parse(await readFile(resolve(root,'local-browser/library/research/texts',name),'utf8'));
      if(saved.id===id&&saved.original_sha256===source.version&&sha(JSON.stringify(saved.pages))===source.extraction_hash){rows=chunksOf(saved).slice(offset,offset+41);break;}
    }catch{/* The database remains a readable fallback for a missing cache. */}
  }
  if(!rows){const db=new CorpusStore(resolve(root,'local-browser/library/research/corpus.sqlite'),{readOnly:true});try{rows=db.db.prepare('SELECT page,start,text,locator FROM passages WHERE source_id=? AND version=? ORDER BY page,start LIMIT 41 OFFSET ?').all(id,source.version,offset);}finally{db.close();}}
  return {
      id, title: meta.title, publisher: meta.publisher, page_count: Number(source.page_count),
      source_url: officialUrl(meta.url), content_format: meta.content_format,
      extraction_status: meta.extraction_status ?? 'DIGITAL_TEXT_UNREVIEWED',
      original_sha256: meta.original_sha256,
      original_available: (await Promise.all(originalPaths(root,id,meta.original_sha256).map(path=>stat(path).then(s=>s.isFile()).catch(()=>false)))).some(Boolean),
      offset, next_offset: rows.length > 40 ? offset + 40 : null,
      passages: rows.slice(0, 40).map(r => ({ page: Number(r.page), start: Number(r.start), text: r.text, locator: r.locator })),
    };
}

export async function libraryOriginal(root, id) {
  const {metadata: document} = libraryMetadata(root, id);
  // Names derive only from an indexed ID. Never accept a client file path or URL.
  for (const path of originalPaths(root,id,document.original_sha256)) {
    let bytes;
    try { bytes = await readFile(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (sha(bytes) !== document.original_sha256) continue;
    const pdf = bytes.subarray(0, 5).toString() === '%PDF-';
    return { bytes, type: pdf ? 'application/pdf' : 'application/octet-stream', disposition: `${pdf ? 'inline' : 'attachment'}; filename="${id}.${pdf ? 'pdf' : 'html'}"` };
  }
  throw Error('LIBRARY_ORIGINAL_UNAVAILABLE');
}
