import type { Citation, CitationCheck, LegalDocument, PrincipalAnalysis } from '../domain/contracts.js';
import { CitationSchema } from '../domain/contracts.js';
import { hash } from '../domain/guards.js';
import { ExactCitationResolver, type CitationResolver } from '../retrieval/index.js';

import { CITATION_FAMILIES, extractCitations, type ExtractionReport } from './extraction.js';
export * from './extraction.js';
import { OfficialEvidenceRegistry } from '../ingestion/provenance.js';

export interface CitationCheckerOptions { registry?: OfficialEvidenceRegistry; simulation?: boolean }

function normalizeWithOffsets(text: string): { text: string; starts: number[]; ends: number[] } {
  let normalized = ''; const starts: number[] = [], ends: number[] = [];
  for (let i=0;i<text.length;i++) {
    const char = text[i]!;
    if (/\s/u.test(char)) {
      if (!normalized || normalized.endsWith(' ')) { if (ends.length) ends[ends.length-1]=i+1; continue; }
      normalized+=' '; starts.push(i); ends.push(i+1);
    } else { normalized+=char; starts.push(i); ends.push(i+1); }
  }
  if (normalized.endsWith(' ')) {normalized=normalized.slice(0,-1);starts.pop();ends.pop();}
  return {text:normalized,starts,ends};
}
const same = (a: string, b: string) => a.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('es') === b.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('es');
const resolutionName = (value:string):string => CITATION_FAMILIES.find(f=>new RegExp('^(?:'+f.marker+')$','iu').test(value.trim()))?.name??value;
export class DeterministicCitationChecker {
  constructor(private readonly options: CitationCheckerOptions = {}, private readonly resolver: CitationResolver = new ExactCitationResolver()) {}
  check(raw: Citation, documents: readonly LegalDocument[], corpusSnapshotId: string): CitationCheck {
    const citation = CitationSchema.parse(raw);
    const base: CitationCheck = {reference_id:citation.reference_id,reference_hash:hash(citation),corpus_snapshot_id:corpusSnapshotId,identity_status:'INSUFFICIENT_IDENTITY',quote_status:citation.quote===null?'NOT_APPLICABLE':'TEXT_UNAVAILABLE',matched_source_ids:[],reason:'Se requiere identidad suficiente en el corpus autorizado.',document_hash:null,document_version_id:null,is_test_fixture:false,provenance_status:'UNTRUSTED',provenance_record:null,quote_match:null};
    const sufficient = Boolean((citation.official_id && citation.court) || (citation.number && citation.court && citation.date && citation.resolution_type));
    if (!sufficient) return base;
    const candidates = this.resolver.resolve(citation,documents);
    if (!candidates.length) return {...base,identity_status:'NOT_FOUND_IN_SCOPE',reason:'No encontrada en este snapshot; no implica inexistencia universal.'};
    const fields = ['court','chamber','resolution_type','number','date','official_id'] as const;
    const matching = candidates.filter(d=>fields.every(k=>citation[k]===null || (d.metadata[k]!==null && (k==='resolution_type'?same(resolutionName(citation[k]!),resolutionName(d.metadata[k]!)):same(citation[k]!,d.metadata[k]!)))) && (!citation.document_version_id || citation.document_version_id===d.document_version_id));
    if (!matching.length) return {...base,identity_status:'METADATA_MISMATCH',matched_source_ids:candidates.map(d=>d.document_id),reason:'Los metadatos o la versión no coinciden con el original registrado.'};
    if (matching.length>1) return {...base,identity_status:'AMBIGUOUS',matched_source_ids:matching.map(d=>d.document_id),reason:'Varias identidades o versiones candidatas; falta desambiguación.'};
    const doc = matching[0]!;
    const matched = {...base,matched_source_ids:[doc.document_id],document_hash:doc.original_hash_sha256,document_version_id:doc.document_version_id,is_test_fixture:doc.is_test_fixture};
    if (doc.verification_status==='UNAVAILABLE' || doc.ingestion_status!=='READY') return {...matched,identity_status:'SOURCE_UNAVAILABLE',reason:'Original no disponible.'};
    const attestation = this.options.registry?.attestationFor(doc) ?? null;
    const simulation = this.options.simulation === true && doc.is_test_fixture;
    if (!attestation && !simulation) return {...matched,identity_status:'SOURCE_UNAVAILABLE',reason:'Falta atestación vigente de un verificador externo de confianza.'};
    matched.provenance_status = attestation ? 'TRUSTED_OFFICIAL' : 'SIMULATION';
    if(attestation){const {document_fingerprint:_fingerprint,schema_version:_version,...claims}=attestation.claims;matched.provenance_record={...claims,attestation_hash:hash(attestation)};}
    if (citation.passage_id && !doc.text_spans.some(p=>p.passage_id===citation.passage_id)) return {...matched,identity_status:'METADATA_MISMATCH',reason:'El fragmento solicitado no existe en esta versión.'};
    const verified: CitationCheck = {...matched,identity_status:'VERIFIED_IDENTITY',reason:'Identidad coincidente exclusivamente dentro del registro autorizado.'};
    if (citation.quote===null) return verified;
    if (doc.extraction_quality!=='GOOD') return {...verified,quote_status:'EXTRACTION_UNCERTAIN'};
    const spans = doc.text_spans.filter(p=>!citation.passage_id || p.passage_id===citation.passage_id);
    if (!spans.length) return {...verified,quote_status:'TEXT_UNAVAILABLE'};
    const quote = normalizeWithOffsets(citation.quote).text;
    if (!quote) return {...verified,quote_status:'QUOTE_MISMATCH'};
    for (const span of spans) {
      const normalized = normalizeWithOffsets(span.text); const at = normalized.text.indexOf(quote);
      if (at>=0) {
        const start=normalized.starts[at]!,end=normalized.ends[at+quote.length-1]!;
        return {...verified,quote_status:'QUOTE_MATCH',quote_match:{passage_id:span.passage_id,start:span.start+start,end:span.start+end,original_text:span.text.slice(start,end)}};
      }
    }
    return {...verified,quote_status:'QUOTE_MISMATCH'};
  }
  checkAnalysis(analysis: PrincipalAnalysis, documents: readonly LegalDocument[], corpusSnapshotId: string, jurisdiction: string): { checks: CitationCheck[]; extraction: ExtractionReport; references: Citation[]; verification_gate: 'PASS_IN_SCOPE' | 'REVIEW_REQUIRED' } {
    // Inspect all prose-bearing fields, including alternatives, limitations and factual statements.
    const prose = [analysis.legal_analysis,...analysis.alternative_interpretations,...analysis.unresolved_issues,...analysis.limitations,...analysis.factual_basis.map(f=>f.statement),...analysis.supporting_references.map(c=>c.raw_text??'')].join('\n');
    const extraction=extractCitations(prose,jurisdiction);
    const references=[...analysis.supporting_references,...extraction.citations.map(e=>e.citation)];
    const checks=references.map(c=>this.check(c,documents,corpusSnapshotId));
    return {checks,extraction,references,verification_gate:extraction.unresolved_markers.length || checks.some(c=>c.identity_status!=='VERIFIED_IDENTITY' || !['QUOTE_MATCH','NOT_APPLICABLE'].includes(c.quote_status))?'REVIEW_REQUIRED':'PASS_IN_SCOPE'};
  }
}
export function citationLabel(citation: Citation, check: CitationCheck | undefined, corpusSnapshotId: string, verificationGate: 'PASS_IN_SCOPE' | 'REVIEW_REQUIRED' = 'REVIEW_REQUIRED'): 'VERIFIED' | 'SIMULATED_VERIFIED' | 'REVIEW_REQUIRED' {
  if (!check || check.reference_hash!==hash(citation) || check.corpus_snapshot_id!==corpusSnapshotId || check.identity_status!=='VERIFIED_IDENTITY' || !['QUOTE_MATCH','NOT_APPLICABLE'].includes(check.quote_status)) return 'REVIEW_REQUIRED';
  if(verificationGate!=='PASS_IN_SCOPE')return 'REVIEW_REQUIRED';
  if(check.provenance_status==='SIMULATION')return 'SIMULATED_VERIFIED';
  return check.provenance_status==='TRUSTED_OFFICIAL' && check.provenance_record ? 'VERIFIED' : 'REVIEW_REQUIRED';
}
