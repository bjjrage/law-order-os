import { describe,it,expect,vi } from 'vitest';
import { CITATION_FAMILIES, detectReferences, extractCitations, citationLabel, DeterministicCitationChecker } from '../../src/citation-checker/index.js';
import { harness, citationFor, syntheticDocument } from '../fixtures/index.js';

describe('J-001 bibliography coverage and closed verification gate',()=>{
  it.each([
    ['A. y S. N° 245/2024 de la Sala Constitucional','Acuerdo y Sentencia','245/2024'],
    ['A y S Nº 246/2024','Acuerdo y Sentencia','246/2024'],
    ['Acuerdo y Sentencia Nro. 247','Acuerdo y Sentencia','247'],
    ['Acordada 334 de fecha 18 de junio de 2025','Acordada','334'],
    ['Auto Interlocutorio número 45','Auto Interlocutorio','45'],
    ['A.I. N.º 46','Auto Interlocutorio','46'],
    ['S. D. Núm. 47','Sentencia Definitiva','47'],
    ['Resol. N° 48','Resolución','48'],
    ['Ley N° 1234/2023','Ley','1234/2023'],
    ['Dec. 49','Decreto','49'],
  ])('extracts %s',(text,type,number)=>{
    const result=extractCitations(text,'PY');expect(result.citations).toHaveLength(1);expect(result.unresolved_markers).toHaveLength(0);
    expect(result.citations[0]!.citation).toMatchObject({resolution_type:type,number});expect(result.detected_reference_count).toBe(1);
  });
  it('retains exact offsets and parses a valid Spanish date',()=>{
    const text='Texto. Acordada 335 de fecha 19 de junio de 2025.';
    const result=extractCitations(text,'PY').citations[0]!;
    expect(text.slice(result.start,result.end)).toBe(result.citation.raw_text);expect(result.citation.date).toBe('2025-06-19');
  });
  it('invalid dates never acquire a fabricated identity',()=>{expect(extractCitations('Ley 2 de fecha 31 de febrero de 2025','PY').citations[0]!.citation.date).toBeNull();});
  it.each(['A. y S. sin número','Acordada s/n','Artículo 17 de la Constitución','Dictamen 15','Referencia XYZ N° 77','Sentencia del tribunal sin identificación'])('unsupported or incomplete %s remains visible',(text)=>{
    const r=extractCitations(text,'PY');expect(r.unresolved_markers.length).toBeGreaterThan(0);expect(r.coverage_status).toBe('REVIEW_REQUIRED');
  });
  it('detects and extracts independently with extensible families',()=>{
    const extension=[...CITATION_FAMILIES,{name:'Circular',marker:'Circular',source_type:'LEGISLATION' as const}];
    expect(detectReferences('Circular N° 81',extension)).toHaveLength(1);
    expect(extractCitations('Circular N° 81','PY',extension).citations[0]!.citation.resolution_type).toBe('Circular');
    expect(extractCitations('Circular N° 81','PY').unresolved_markers).toHaveLength(1);
  });
  it('assigns context-sensitive families using their original source context',()=>{
    const families=[{name:'ConditionalTest',marker:'TEST(?=\\s+N)',source_type:'LEGISLATION' as const}];
    expect(extractCitations('TEST Nro. 391','PY',families).citations[0]!.citation.resolution_type).toBe('ConditionalTest');
    expect(extractCitations('AI Nro. 392','PY').citations[0]!.citation.resolution_type).toBe('Auto Interlocutorio');
  });
  it('enumerates adjacent references and preserves coverage counts',()=>{
    const r=extractCitations('Ley 3; A.I. N° 4 y Acordada 5. Art. 6. Dictamen 7.','PY');
    expect(r.citations.map(c=>c.citation.number)).toEqual(['3','4','5']);
    expect(r.detected_reference_count).toBe(r.citations.length+r.unresolved_markers.length);
  });
  it('ordinary prose does not pretend to be a reference',()=>{const r=extractCitations('Se recibió la entrega documental ayer.','PY');expect(r.detected_reference_count).toBe(0);});
  it('unknown references suppress even otherwise valid individual export labels',()=>{
    const doc=syntheticDocument(),checker=new DeterministicCitationChecker({simulation:true}),c=citationFor(doc);
    expect(citationLabel(c,checker.check(c,[doc],'s'),'s','REVIEW_REQUIRED')).toBe('REVIEW_REQUIRED');
  });
  it('resolution aliases resolve to the same type without merging different types',()=>{
    const checker=new DeterministicCitationChecker({simulation:true});
    const doc=syntheticDocument({metadata:{...syntheticDocument().metadata,resolution_type:'A.I.'}});
    const c=citationFor(doc,{resolution_type:'Auto Interlocutorio'});
    expect(checker.check(c,[doc],'s').identity_status).toBe('VERIFIED_IDENTITY');
    expect(checker.check({...c,resolution_type:'Sentencia Definitiva'},[doc],'s').identity_status).toBe('METADATA_MISMATCH');
  });
  it('raw text in structured references is included in coverage checks',async()=>{
    const h=harness(),invoke=h.providers.sol.invoke.bind(h.providers.sol);
    vi.spyOn(h.providers.sol,'invoke').mockImplementation(async(c,s)=>{const r=await invoke(c,s);r.output.supporting_references[0]!.raw_text='Dictamen 998';return r;});
    const run=await h.board.execute(h.actor,h.request,h.snapshot);
    expect(run.status).toBe('PARTIAL');expect(run.error_code).toBe('CITATION_EXTRACTION_REVIEW_REQUIRED');
  });
  it.each(['legal_analysis','alternative_interpretations','unresolved_issues','limitations'] as const)('blocks the board on unsupported references in %s',async(field)=>{
    const h=harness(),invoke=h.providers.sol.invoke.bind(h.providers.sol);
    vi.spyOn(h.providers.sol,'invoke').mockImplementation(async(c,s)=>{const r=await invoke(c,s);if(field==='legal_analysis')r.output[field]='Dictamen N° 778';else r.output[field]=['Dictamen N° 778'];return r;});
    const run=await h.board.execute(h.actor,h.request,h.snapshot);
    expect(run.status).toBe('PARTIAL');expect(run.reference_verification).toBe('REVIEW_REQUIRED');expect(run.error_code).toBe('CITATION_EXTRACTION_REVIEW_REQUIRED');
    expect(run.stages.at(-1)).toMatchObject({stage_name:'CHECKING_REFERENCES',status:'BLOCKED'});expect(run.history).not.toContain('HUMAN_REVIEW_PENDING');
  });
  it('an extracted fabricated abbreviated judgment cannot bypass the identity gate',async()=>{
    const h=harness(),invoke=h.providers.sol.invoke.bind(h.providers.sol);
    vi.spyOn(h.providers.sol,'invoke').mockImplementation(async(c,s)=>{const r=await invoke(c,s);r.output.legal_analysis='A. y S. N° 245/2024 de la Sala Constitucional';return r;});
    const run=await h.board.execute(h.actor,h.request,h.snapshot);expect(run.status).toBe('PARTIAL');
    expect(run.citation_checks.some(c=>c.identity_status==='INSUFFICIENT_IDENTITY')).toBe(true);expect(run.error_code).toBe('REFERENCE_VERIFICATION_REQUIRED');
  });
});
