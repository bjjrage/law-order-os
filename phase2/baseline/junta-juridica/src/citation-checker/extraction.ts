import { CitationSchema, type Citation } from '../domain/contracts.js';
import { hash } from '../domain/guards.js';

export interface CitationFamily {
  name: string; source_type: 'OFFICIAL_CASELAW' | 'LEGISLATION'; marker: string;
}
// Extend families without changing detection, extraction or identity resolution.
// Parsing rules are not a claim of exhaustive official bibliography.
export const CITATION_FAMILIES: readonly CitationFamily[] = [
  {name:'Acuerdo y Sentencia',source_type:'OFFICIAL_CASELAW',marker:/Acuerdo\s+y\s+Sentencia|A\s*\.?\s*y\s*\.?\s*S\.?/.source},
  {name:'Auto Interlocutorio',source_type:'OFFICIAL_CASELAW',marker:/Auto\s+Interlocutorio|A\s*\.\s*I\.?|AI(?=\s+(?:N|n[uú]m|\d))/.source},
  {name:'Sentencia Definitiva',source_type:'OFFICIAL_CASELAW',marker:/Sentencia\s+Definitiva|S\s*\.\s*D\.?/.source},
  {name:'Sentencia',source_type:'OFFICIAL_CASELAW',marker:/Sentencia|Sent\./.source},
  {name:'Resolución',source_type:'OFFICIAL_CASELAW',marker:/Resoluci[oó]n|Resol\.|Res\./.source},
  {name:'Acordada',source_type:'OFFICIAL_CASELAW',marker:/Acordada|Ac\./.source},
  {name:'Ley',source_type:'LEGISLATION',marker:/Ley/.source},
  {name:'Decreto',source_type:'LEGISLATION',marker:/Decreto|Dec\./.source},
];
const NUMBER_PREFIX = /(?:N(?:\s*\.?\s*[°ºo]|\s*ro\.?)?|N[uú]m(?:ero)?\.?)/.source;
export interface DetectedReference { text: string; start: number; end: number; family: CitationFamily | null }
export interface ExtractedCitation { citation: Citation; start: number; end: number }
export interface ExtractionReport {
  citations: ExtractedCitation[];
  unresolved_markers: {text:string;start:number;end:number}[];
  detected_reference_count: number; coverage_status: 'COVERED_IN_GRAMMAR' | 'REVIEW_REQUIRED';
  extractor_version: string;
}
export function detectReferences(text: string, families: readonly CitationFamily[] = CITATION_FAMILIES): DetectedReference[] {
  const generic = /jurisprudencia|art[ií]culo|art\.|constituci[oó]n|c[oó]digo|fallo|dictamen|precedente|expediente|expte\./.source;
  const regex = new RegExp('(?<![\\p{L}\\p{N}])(?:'+families.map(f=>f.marker).join('|')+'|'+generic+')(?![\\p{L}])','giu');
  const detections: DetectedReference[] = [...text.matchAll(regex)].map(m=>({
    text:m[0],start:m.index,end:m.index+m[0].length,
    family:families.find(f=>new RegExp('^(?:'+f.marker+')(?![\\p{L}])','iu').exec(text.slice(m.index))?.[0]===m[0])??null,
  }));
  // Numbered references in unsupported notations must still reach review.
  for (const m of text.matchAll(new RegExp('(?<![\\p{L}\\p{N}])'+NUMBER_PREFIX+'\\s*\\d[\\d./-]*','giu'))) {
    if (!detections.some(d=>d.end<=m.index && /^\s*[:,-]?\s*$/u.test(text.slice(d.end,m.index)))) {
      detections.push({text:m[0],start:m.index,end:m.index+m[0].length,family:null});
    }
  }
  return detections.sort((a,b)=>a.start-b.start);
}
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function parseDate(raw:string):string|null {
  const iso=raw.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if(iso && !Number.isNaN(Date.parse(iso)) && new Date(iso).toISOString().slice(0,10)===iso)return iso;
  const spanish=raw.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})\b/iu);
  if(!spanish)return null;
  const month=months.indexOf(spanish[2]!.toLocaleLowerCase('es'))+1;
  const candidate=spanish[3]+'-'+String(month).padStart(2,'0')+'-'+spanish[1]!.padStart(2,'0');
  return month && !Number.isNaN(Date.parse(candidate)) && new Date(candidate).toISOString().slice(0,10)===candidate?candidate:null;
}
export function extractCitations(text:string,jurisdiction:string,families:readonly CitationFamily[]=CITATION_FAMILIES):ExtractionReport {
  const detected=detectReferences(text,families),citations:ExtractedCitation[]=[],unresolved:ExtractionReport['unresolved_markers']=[];
  for(const [index,marker] of detected.entries()){
    const tail=text.slice(marker.end,detected[index+1]?.start??text.length);
    const number=tail.match(new RegExp('^\\s*[:,-]?\\s*(?:'+NUMBER_PREFIX+'\\s*)?(\\d+(?:[./-]\\d+)*)','iu'));
    if(!marker.family || !number){unresolved.push({text:marker.text,start:marker.start,end:marker.end});continue;}
    const raw=text.slice(marker.start,detected[index+1]?.start??text.length).split(/[\n;]/u)[0]!;
    const court=raw.match(/(?:tribunal|organismo)\s*[:=]\s*([^|;\n]+?)(?=\s*\||$)/iu)?.[1]?.trim()??null;
    const chamber=raw.match(/sala\s*[:=]\s*([^|;\n]+?)(?=\s*\||$)/iu)?.[1]?.trim()??null;
    const quote=raw.match(/[“"]([^”"]+)[”"]/u)?.[1]??null;
    const citation=CitationSchema.parse({
      reference_id:'free:'+marker.start+':'+hash(raw).slice(0,12),source_id:null,document_version_id:null,passage_id:null,
      source_type:marker.family.source_type,jurisdiction,court,chamber,resolution_type:marker.family.name,
      number:number[1],date:parseDate(raw),official_id:null,quote,raw_text:raw,
    });
    citations.push({citation,start:marker.start,end:marker.start+raw.length});
  }
  return {citations,unresolved_markers:unresolved,detected_reference_count:detected.length,
    coverage_status:unresolved.length?'REVIEW_REQUIRED':'COVERED_IN_GRAMMAR',extractor_version:'es-bibliography-v2'};
}
