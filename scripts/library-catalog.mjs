import {resolve} from 'node:path';
import {CorpusStore,normalize} from './library-corpus-store.mjs';
const facets=new Map();
export function queryCatalog(root,{query='',type='',year='',page=1,ids=[],indexedOnly=false}={}){
  const db=new CorpusStore(resolve(root,'local-browser/library/research/corpus.sqlite'),{readOnly:true});
  try{
    const clauses=[],args=[];const tokens=normalize(query).match(/[a-z0-9]{2,}/g)?.slice(0,20)??[];
    let from='library_records r LEFT JOIN sources s ON s.id=r.id';
    if(indexedOnly)clauses.push('s.id IS NOT NULL');
    if(tokens.length){from+=' JOIN record_titles ON record_titles.rowid=r.rowid';clauses.push('record_titles MATCH ?');args.push(tokens.map(t=>'"'+t+'"*').join(' AND '));}
    if(type&&type!=='Todas'){clauses.push("json_extract(r.record,'$.type')=?");args.push(type);}
    if(year){clauses.push("json_extract(r.record,'$.year')=?");args.push(year);}
    if(ids.length){clauses.push('r.id IN ('+ids.map(()=>'?').join(',')+')');args.push(...ids);}
    const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
    const total=Number(db.db.prepare('SELECT count(*) AS n FROM '+from+where).get(...args).n);
    const records=db.db.prepare("SELECT r.record,s.id AS indexed_id,json_extract(s.metadata,'$.extraction_status') AS extraction_status FROM "+from+where+" ORDER BY coalesce(json_extract(r.record,'$.year'),'') DESC,r.title LIMIT 50 OFFSET ?").all(...args,(page-1)*50).map(r=>({...JSON.parse(r.record),text_indexed:r.indexed_id!==null,...(r.extraction_status?{extraction_status:r.extraction_status}:{})}));
    const facetKey=root+':'+indexedOnly,facetFrom='library_records r'+(indexedOnly?' JOIN sources s ON s.id=r.id':'');
    let facet=facets.get(facetKey);
    if(!facet||Date.now()-facet.at>=30000){
      const counts=Object.fromEntries(db.db.prepare("SELECT json_extract(r.record,'$.type') AS type,count(*) AS n FROM "+facetFrom+" GROUP BY type").all().map(r=>[r.type,Number(r.n)]));
      const years=db.db.prepare("SELECT DISTINCT json_extract(r.record,'$.year') AS year FROM "+facetFrom+" WHERE length(json_extract(r.record,'$.year'))=4 ORDER BY year DESC").all().map(r=>r.year);
      facet={at:Date.now(),counts,years};if(facets.size>=8)facets.delete(facets.keys().next().value);facets.set(facetKey,facet);
    }
    return {schema_version:2,fetched_at:new Date().toISOString(),records,total,page,page_size:50,counts:facet.counts,years:facet.years};
  }finally{db.close();}
}
