import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
export const sha = data => createHash('sha256').update(data).digest('hex');
export const normalize = s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function chunksOf(source) {
  const result=[];
  for(const page of source.pages){
    const text=page.text.replace(/\s+/g,' ').trim();
    for(let start=0;start<text.length;){
      const end=Math.min(start+1250,text.length),body=text.slice(start,end);
      const articles=[...text.slice(0,start+80).matchAll(/(?:Art[íi]culo|Art\.)\s*(\d+[\wº°]*)/gi)];
      if(body.trim().length>=60)result.push({passage_id:`${source.id}:p${page.page}:${start}`,page:page.page,start,text:body,locator:source.content_format==='HTML'?(articles.length?'Artículo '+articles.at(-1)[1]:'Sección del texto oficial'):undefined});
      if(end===text.length)break;
      const boundary=text.indexOf(' ',Math.max(start+1,end-180));start=boundary>=0&&boundary<end?boundary+1:end;
    }
  }
  return result;
}
export class CorpusStore {
  constructor(path,{readOnly=false}={}){
    this.db=new DatabaseSync(path,{readOnly});this.db.exec('PRAGMA busy_timeout=10000');
    if(!readOnly)this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,version TEXT NOT NULL,metadata TEXT NOT NULL,page_count INTEGER NOT NULL,characters INTEGER NOT NULL,extraction_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS versions(id TEXT NOT NULL,version TEXT NOT NULL,metadata TEXT NOT NULL,extraction_hash TEXT NOT NULL,PRIMARY KEY(id,version));
      CREATE TABLE IF NOT EXISTS ingestion(id TEXT PRIMARY KEY,status TEXT NOT NULL,reason TEXT,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS library_records(id TEXT PRIMARY KEY,record TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS job_state(id TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS extractions(id TEXT NOT NULL,version TEXT NOT NULL,extraction_hash TEXT NOT NULL,metadata TEXT NOT NULL,PRIMARY KEY(id,version,extraction_hash));
      CREATE VIRTUAL TABLE IF NOT EXISTS passages USING fts5(title,text,source_id UNINDEXED,version UNINDEXED,passage_id UNINDEXED,page UNINDEXED,start UNINDEXED,locator UNINDEXED,tokenize='unicode61 remove_diacritics 2');`);
    if(!readOnly){
      if(!this.db.prepare('PRAGMA table_info(library_records)').all().some(c=>c.name==='title'))this.db.exec("ALTER TABLE library_records ADD COLUMN title TEXT NOT NULL DEFAULT ''");
      this.db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS record_titles USING fts5(title,content='library_records',content_rowid='rowid',tokenize='unicode61 remove_diacritics 2');
        CREATE TRIGGER IF NOT EXISTS records_ai AFTER INSERT ON library_records BEGIN INSERT INTO record_titles(rowid,title) VALUES(new.rowid,new.title); END;
        CREATE TRIGGER IF NOT EXISTS records_ad AFTER DELETE ON library_records BEGIN INSERT INTO record_titles(record_titles,rowid,title) VALUES('delete',old.rowid,old.title); END;
        CREATE TRIGGER IF NOT EXISTS records_au AFTER UPDATE ON library_records BEGIN INSERT INTO record_titles(record_titles,rowid,title) VALUES('delete',old.rowid,old.title); INSERT INTO record_titles(rowid,title) VALUES(new.rowid,new.title); END;`);
    }
  }
  close(){this.db.close();}
  has(id){return !!this.db.prepare('SELECT 1 FROM sources WHERE id=?').get(id);}
  status(id){return this.db.prepare('SELECT status FROM ingestion WHERE id=?').get(id)?.status;}
  mark(id,status,reason=null){this.db.prepare('INSERT OR REPLACE INTO ingestion VALUES(?,?,?,?)').run(id,status,reason,new Date().toISOString());}
  upsert(source){
    const chunks=chunksOf(source);if(!chunks.length)throw Error('NO_USABLE_TEXT');
    const {pages,...meta}=source,extractionHash=sha(JSON.stringify(pages));
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('DELETE FROM passages WHERE source_id=?').run(source.id);
      this.db.prepare('INSERT OR REPLACE INTO sources VALUES(?,?,?,?,?,?)').run(source.id,source.original_sha256,JSON.stringify(meta),pages.length,pages.reduce((n,p)=>n+p.text.length,0),extractionHash);
      this.db.prepare('INSERT OR REPLACE INTO versions VALUES(?,?,?,?)').run(source.id,source.original_sha256,JSON.stringify(meta),extractionHash);
      const insert=this.db.prepare('INSERT INTO passages(title,text,source_id,version,passage_id,page,start,locator) VALUES(?,?,?,?,?,?,?,?)');
      for(const c of chunks)insert.run(source.title,c.text,source.id,source.original_sha256,c.passage_id,c.page,c.start,c.locator??null);
      this.db.prepare('INSERT OR IGNORE INTO extractions VALUES(?,?,?,?)').run(source.id,source.original_sha256,extractionHash,JSON.stringify(meta));
      this.mark(source.id,source.ocr?.unreadable_pages?.length?'INDEXED_PARTIAL':'INDEXED');this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  register(records){
    const q=this.db.prepare('INSERT INTO library_records(id,record,updated_at,title) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record,updated_at=excluded.updated_at,title=excluded.title WHERE library_records.record<>excluded.record');
    this.db.exec('BEGIN');try{for(const r of records)q.run(r.id,JSON.stringify(r),new Date().toISOString(),r.title);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  located(tokens){const safe=[...new Set(tokens.map(normalize).filter(t=>/^[a-z0-9]{3,}$/.test(t)))].slice(0,32);if(!safe.length)return[];
    return this.db.prepare('SELECT r.record FROM record_titles t JOIN library_records r ON r.rowid=t.rowid WHERE record_titles MATCH ? ORDER BY bm25(record_titles) LIMIT 40').all(safe.map(t=>'"'+t+'"*').join(' OR ')).map(r=>JSON.parse(r.record));
  }
  state(id,value){if(value===undefined){const row=this.db.prepare('SELECT value FROM job_state WHERE id=?').get(id);return row?JSON.parse(row.value):null;}this.db.prepare('INSERT OR REPLACE INTO job_state VALUES(?,?)').run(id,JSON.stringify(value));return value;}
  candidates(tokens,asOf,{limit=240}={}){
    const safe=[...new Set(tokens.map(normalize).filter(t=>/^[a-z0-9]{3,}$/.test(t)))].slice(0,32);
    if(!safe.length)return {sources:[]};
    const query=safe.map(t=>'"'+t+'"*').join(' OR ');
    // All user terms are bound as data; future and fully repealed records are excluded before ranking.
    const rows=this.db.prepare(`SELECT p.*,s.metadata,bm25(passages,2.0,1.0) AS score FROM passages p JOIN sources s ON s.id=p.source_id AND s.version=p.version
      WHERE passages MATCH ? AND (json_extract(s.metadata,'$.published_date') IS NULL OR json_extract(s.metadata,'$.published_date')<=?)
      AND coalesce(json_extract(s.metadata,'$.normative_status'),'')!='TOTALMENTE' ORDER BY score LIMIT ?`).all(query,asOf,Math.min(1000,Math.max(1,limit)));
    const sources=new Map();
    for(const r of rows){let source=sources.get(r.source_id);if(!source){source={...JSON.parse(r.metadata),pages:[]};sources.set(r.source_id,source);}source.pages.push({page:Number(r.page),text:r.text,start:Number(r.start),passage_id:r.passage_id,locator:r.locator??undefined});}
    return {sources:[...sources.values()]};
  }
  coverage(){
    const sources=this.db.prepare('SELECT metadata,page_count,characters FROM sources ORDER BY id').all().map(r=>({...JSON.parse(r.metadata),page_count:Number(r.page_count),characters:Number(r.characters)}));
    const states=this.db.prepare('SELECT status,count(*) AS count FROM ingestion GROUP BY status').all();
    return {schema_version:2,updated_at:new Date().toISOString(),sources,passages:Number(this.db.prepare('SELECT count(*) AS count FROM passages_docsize').get().count),statuses:Object.fromEntries(states.map(r=>[r.status,Number(r.count)])),page_count:sources.reduce((n,s)=>n+s.page_count,0)};
  }
}
