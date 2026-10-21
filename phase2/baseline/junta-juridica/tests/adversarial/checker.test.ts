import { describe,it,expect } from 'vitest';
import { DeterministicCitationChecker, citationLabel, extractCitations } from '../../src/citation-checker/index.js';
import { citationFor,syntheticDocument } from '../fixtures/index.js';
import type { Citation } from '../../src/domain/contracts.js';

describe('deterministic bibliographic identity, synthetic authorized records',()=>{
  const checker=new DeterministicCitationChecker({simulation:true});const doc=syntheticDocument();
  const check=(changes:Partial<Citation>={})=>checker.check(citationFor(doc,changes),[doc],'snapshot1');
  it('01 matching original and metadata verifies scoped identity',()=>{expect(check().identity_status).toBe('VERIFIED_IDENTITY');});
  it('02 wholly invented reference is never verified',()=>{expect(check({source_id:null,official_id:null,number:'999999'}).identity_status).toBe('NOT_FOUND_IN_SCOPE');});
  it('03 existing number with wrong court mismatches',()=>{expect(check({court:'Tribunal inexistente'}).identity_status).toBe('METADATA_MISMATCH');});
  it('04 existing number with wrong date mismatches',()=>{expect(check({date:'2024-01-16'}).identity_status).toBe('METADATA_MISMATCH');});
  it('05 insufficient identity or number alone is not proof',()=>{expect(check({source_id:null,official_id:null,court:null,date:null}).identity_status).toBe('INSUFFICIENT_IDENTITY');});
  it('06 two matching candidates remain ambiguous',()=>{
    const other=syntheticDocument({document_id:'duplicate'});expect(checker.check(citationFor(doc,{source_id:null,document_version_id:null,passage_id:null}),[doc,other],'snapshot1').identity_status).toBe('AMBIGUOUS');
  });
  it('07 inaccessible official original stays unavailable',()=>{
    const inaccessible=structuredClone(doc);inaccessible.verification_status='UNAVAILABLE';expect(checker.check(citationFor(doc),[inaccessible],'snapshot1').identity_status).toBe('SOURCE_UNAVAILABLE');
  });
  it('08 real identity with invented quote fails textual check and export gate',()=>{
    const c=citationFor(doc,{quote:'La notificación no requiere registro alguno.'});const result=checker.check(c,[doc],'snapshot1');expect(result.quote_status).toBe('QUOTE_MISMATCH');expect(citationLabel(c,result,'snapshot1')).toBe('REVIEW_REQUIRED');
  });
  it('09 citation appearing only in free text is extracted and checked',()=>{
    const extracted=extractCitations('Sentencia N° 999999 del 2024-01-15 | tribunal: Tribunal Sintético de Prueba','PY');expect(extracted.citations).toHaveLength(1);expect(checker.check(extracted.citations[0]!.citation,[doc],'snapshot1').identity_status).toBe('NOT_FOUND_IN_SCOPE');
  });
  it('10 private pleading mentioning a nonexistent judgment does not authenticate it',()=>{
    const privateDoc=syntheticDocument({source_type:'PRIVATE_MATTER',document_id:'private-mention'},'Sentencia N° 999999, supuestamente existente.');
    expect(checker.check(citationFor(doc,{source_id:privateDoc.document_id,number:'999999'}),[privateDoc],'snapshot1').identity_status).toBe('NOT_FOUND_IN_SCOPE');
  });
  it('11 defective extraction keeps textual verification uncertain',()=>{
    const damaged=structuredClone(doc);damaged.extraction_quality='UNCERTAIN';expect(checker.check(citationFor(doc,{quote:'texto inexistente'}),[damaged],'snapshot1').quote_status).toBe('EXTRACTION_UNCERTAIN');
  });
  it('12 modifying a previously checked reference invalidates prior result',()=>{
    const citation=citationFor(doc);const result=checker.check(citation,[doc],'snapshot1');citation.date='2023-01-15';expect(citationLabel(citation,result,'snapshot1')).toBe('REVIEW_REQUIRED');expect(checker.check(citation,[doc],'snapshot1').identity_status).toBe('METADATA_MISMATCH');
  });
  it('a private original cannot masquerade as official by source ID',()=>{
    const privateDoc=syntheticDocument({source_type:'PRIVATE_MATTER'});expect(checker.check(citationFor(privateDoc),[privateDoc],'snapshot1').identity_status).not.toBe('VERIFIED_IDENTITY');
  });
  it('wrong version and missing original passage are mismatches',()=>{expect(check({document_version_id:'v999'}).identity_status).toBe('METADATA_MISMATCH');expect(check({passage_id:'nonexistent'}).identity_status).toBe('METADATA_MISMATCH');});
  it('literal whitespace normalization retains original offsets and text',()=>{
    const source=syntheticDocument({},'Constancia:  entrega\n  documentada.');const result=checker.check(citationFor(source,{quote:'entrega documentada.'}),[source],'s');expect(result.quote_status).toBe('QUOTE_MATCH');expect(result.quote_match?.original_text).toBe('entrega\n  documentada.');expect(result.quote_match?.start).toBe(13);
  });
  it('paraphrase, accent changes and changed punctuation are not literal matches',()=>{expect(check({quote:'La notificacion requiere constancia documental.'}).quote_status).toBe('QUOTE_MISMATCH');});
  it('synthetic source never exports as real VERIFIED',()=>{const c=citationFor(doc);expect(citationLabel(c,checker.check(c,[doc],'s'),'s','PASS_IN_SCOPE')).toBe('SIMULATED_VERIFIED');});
  it('verification from another corpus snapshot is invalid',()=>{const c=citationFor(doc);expect(citationLabel(c,checker.check(c,[doc],'s'),'different')).toBe('REVIEW_REQUIRED');});
  it('unrecognized citation markers are retained as coverage objections',()=>{expect(extractCitations('La sentencia mencionada por la parte no trae número.','PY').unresolved_markers).toHaveLength(1);});
  it('legislation has separate identity scope and matching quote',()=>{const law=syntheticDocument({source_type:'LEGISLATION'});expect(checker.check(citationFor(law,{quote:law.text_spans[0]!.text}),[law],'s').quote_status).toBe('QUOTE_MATCH');});
  it('two references on the same line are independently extracted',()=>{const result=extractCitations('Sentencia N° 111 del 2024-01-15 y Sentencia N° 222 del 2024-01-16','PY');expect(result.citations.map(c=>c.citation.number)).toEqual(['111','222']);});
});
