import { describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { DeterministicCitationChecker, citationLabel, extractCitations } from '../../src/citation-checker/index.js';
import { OfficialEvidenceRegistry, attestationMessage } from '../../src/ingestion/provenance.js';
import { LocalEvidenceIndex } from '../../src/retrieval/index.js';
import { hash } from '../../src/domain/guards.js';
import type { PrincipalAnalysis } from '../../src/domain/contracts.js';
import { trustFixture } from '../fixtures/trust.js';
import { citationFor, syntheticDocument, DEMO_ACTOR, harness } from '../fixtures/index.js';

const scope={study_id:DEMO_ACTOR.study_id,matter_id:'asunto-demo'};
function analysis(prose:string):PrincipalAnalysis {
  return {analysis_id:'a1',request_id:'r1',question_analyzed:'Pregunta sintética delimitada',factual_basis:[],legal_analysis:prose,
    alternative_interpretations:[],supporting_references:[],unresolved_issues:[],additional_evidence_requests:[],limitations:[],completion_status:'COMPLETE_DRAFT'};
}
function reference(quote:string){
  const t=trustFixture();t.registry.register(t.document,t.attestation);
  const m=t.document.metadata;
  const text=`Texto libre: Sentencia ${m.number} | tribunal: ${m.court} | sala: ${m.chamber} | ${m.date} | ${quote}`;
  return {t,text,checked:new DeterministicCitationChecker({registry:t.registry}).checkAnalysis(analysis(text),[t.document],'snapshot','PY')};
}

describe('Phase 2 A1 J-001 independent additional regression design (synthetic)',()=>{
  it.each(['«Texto inventado»','‘Texto inventado’',"'Texto inventado'"])(
    'does not omit a fabricated literal quotation delimited with %s',(quote)=>{
      const {checked}=reference(quote);
      expect(checked.verification_gate).toBe('REVIEW_REQUIRED');
      expect(checked.checks[0]!.quote_status).toBe('QUOTE_MISMATCH');
      expect(checked.references[0]!.quote).toBe('Texto inventado');
    });
  it.each(['«Texto inventado','“Texto inventado',"'Texto inventado",'Texto inventado»'])(
    'an unbalanced quotation remains visible for review: %s',(quote)=>{
      const {checked,text}=reference(quote);
      expect(checked.verification_gate).toBe('REVIEW_REQUIRED');
      expect(checked.extraction.unresolved_markers.length).toBeGreaterThan(0);
      for(const m of checked.extraction.unresolved_markers)expect(text.slice(m.start,m.end)).toBe(m.text);
    });
  it('does not silently verify a second, unchecked literal quote',()=>{
    const t=trustFixture();const {checked}=reference(`«${t.document.text_spans[0]!.text}» y «Texto inventado»`);
    expect(checked.verification_gate).toBe('REVIEW_REQUIRED');
    expect(checked.extraction.unresolved_markers.length).toBeGreaterThan(0);
    expect(checked.extraction.detected_reference_count).toBe(1);
  });
  it.each([['«','»'],['‘','’'],["'","'"]])('retains authentic fixture quote text between %s %s',(open,close)=>{
    const t=trustFixture(),literal=t.document.text_spans[0]!.text,{checked}=reference(open+literal+close);
    expect(checked.verification_gate).toBe('PASS_IN_SCOPE');expect(checked.checks[0]!.quote_status).toBe('QUOTE_MATCH');
    expect(checked.checks[0]!.quote_match!.original_text).toBe(literal);
  });
  it('does not mistake an internal apostrophe in a name for an unmatched literal quotation',()=>{
    const {checked}=reference("Atribución a O'Brien");expect(checked.verification_gate).toBe('PASS_IN_SCOPE');
    expect(checked.references[0]!.quote).toBeNull();expect(checked.extraction.unresolved_markers).toEqual([]);
  });
  it.each(['A . y . S . N.º 871/2023','AI número 872','S.D. Nro. 873','Res. Nº 874'])(
    'keeps original prose, offsets and probable source family for %s',(raw)=>{
      const text=`Introducción. ${raw} | tribunal: Corte de Prueba | sala: Constitucional | 12 de octubre de 2023`;
      const r=extractCitations(text,'PY');expect(r.citations).toHaveLength(1);
      const c=r.citations[0]!;expect(text.slice(c.start,c.end)).toBe(c.citation.raw_text);
      expect(c.citation).toMatchObject({source_type:'OFFICIAL_CASELAW',court:'Corte de Prueba',chamber:'Constitucional',date:'2023-10-12'});
    });
  it('never turns missing scoped evidence into universal nonexistence',()=>{
    const doc=syntheticDocument(),checker=new DeterministicCitationChecker({simulation:true});
    const checked=checker.check(citationFor(doc,{source_id:'absent'}),[doc],'s');
    expect(checked.identity_status).toBe('NOT_FOUND_IN_SCOPE');expect(checked.reason).toContain('no implica inexistencia universal');
  });
  it('the board closes on a fabricated guillemet quote and idempotent reuse does not replay models',async()=>{
    const h=harness(),original=h.providers.sol.invoke.bind(h.providers.sol),m=h.documents[0]!.metadata;
    const invoke=vi.spyOn(h.providers.sol,'invoke').mockImplementation(async(c,s)=>{
      const r=await original(c,s);r.output.legal_analysis=`Sentencia ${m.number} | tribunal: ${m.court} | sala: ${m.chamber} | ${m.date} | «Texto inventado»`;return r;
    });
    const first=await h.board.execute(h.actor,h.request,h.snapshot),again=await h.board.execute(h.actor,h.request,h.snapshot);
    expect(first.status).toBe('PARTIAL');expect(first.error_code).toBe('REFERENCE_VERIFICATION_REQUIRED');
    expect(first.citation_checks.some(c=>c.quote_status==='QUOTE_MISMATCH')).toBe(true);
    expect(again).toEqual(first);expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 2 A1 J-002 signer and host trust boundaries',()=>{
  it('rejects an authorized-looking issuer ID signed with another private key',()=>{
    const t=trustFixture(),other=generateKeyPairSync('ed25519');
    const forged={claims:t.claims,signature_base64:sign(null,attestationMessage(t.claims),other.privateKey).toString('base64')};
    expect(()=>t.registry.register(t.document,forged)).toThrow('OFFICIAL_ATTESTATION_INVALID');
  });
  it('a cryptographically valid signature from another configured verifier does not inherit identity permission',()=>{
    const t=trustFixture();const registry=new OfficialEvidenceRegistry([{...t.verifier,verified_by:'ANOTHER_AUTHORIZED_ACTOR'}],()=>t.now);
    expect(()=>registry.register(t.document,t.attestation)).toThrow('OFFICIAL_ATTESTATION_INVALID');
  });
  it('a valid signed source cannot move outside the configured exact HTTPS host',()=>{
    for(const origin_uri of ['https://official.example.test@evil.test/r','https://evil.test/r','https://official.example.test:8443/r']){
      const t=trustFixture(),doc={...t.document,origin_uri};
      const attestation=t.signed({source_url:origin_uri,document_fingerprint:hash(doc)});
      expect(()=>t.registry.register(doc,attestation)).toThrow('OFFICIAL_ATTESTATION_INVALID');
    }
  });
  it('caller mutation after registration cannot alter signed rights or verifier scope',()=>{
    const t=trustFixture();const config=structuredClone(t.verifier),record=structuredClone(t.attestation);
    const registry=new OfficialEvidenceRegistry([config],()=>t.now);registry.register(t.document,record);
    config.allowed_hosts.push('evil.test');record.claims.rights_record='changed';
    expect(registry.attestationFor(t.document)!.claims.rights_record).toBe(t.claims.rights_record);
  });
  it('a replacement registry without the trusted key cannot revalidate an old official document',()=>{
    const t=trustFixture();t.registry.register(t.document,t.attestation);
    const c=citationFor(t.document),checked=new DeterministicCitationChecker({registry:new OfficialEvidenceRegistry()}).check(c,[t.document],'s');
    expect(checked.provenance_status).toBe('UNTRUSTED');expect(citationLabel(c,checked,'s','PASS_IN_SCOPE')).toBe('REVIEW_REQUIRED');
  });
  it('an expiration boundary revalidates both checker identity and textual quotation',()=>{
    const t=trustFixture();let now=t.now;const registry=new OfficialEvidenceRegistry([t.verifier],()=>now);registry.register(t.document,t.attestation);
    const checker=new DeterministicCitationChecker({registry}),c=citationFor(t.document,{quote:t.document.text_spans[0]!.text});
    expect(checker.check(c,[t.document],'s').quote_status).toBe('QUOTE_MATCH');
    now=Date.parse(t.claims.expires_at);const checked=checker.check(c,[t.document],'s');
    expect(checked.identity_status).toBe('SOURCE_UNAVAILABLE');expect(citationLabel(c,checked,'s','PASS_IN_SCOPE')).toBe('REVIEW_REQUIRED');
  });
});

describe('Phase 2 A1 J-003 publication, history and tenant isolation',()=>{
  const v1=syntheticDocument({document_id:'audit-doc',document_version_id:'opaque-z'},'Primera versión');
  const v2=syntheticDocument({document_id:'audit-doc',document_version_id:'opaque-a'},'Segunda versión');
  it('a subsequent unpublished candidate cannot replace an explicit publication',()=>{
    const index=new LocalEvidenceIndex([v1],undefined,{'audit-doc':v1.document_version_id}),old=index.snapshot(DEMO_ACTOR,scope);
    index.add(v2);expect(index.snapshot(DEMO_ACTOR,scope)).toEqual(old);
    index.publishVersion('audit-doc',v2.document_version_id);expect(index.snapshot(DEMO_ACTOR,scope).hash).not.toBe(old.hash);
    expect(index.documents(DEMO_ACTOR,scope,old)).toEqual([v1]);
  });
  it('mutation of caller-owned publication maps cannot change a snapshot head',()=>{
    const head={'audit-doc':v1.document_version_id},index=new LocalEvidenceIndex([v2,v1],undefined,head);
    head['audit-doc']=v2.document_version_id;expect(index.snapshot(DEMO_ACTOR,scope).documents[0]!.document_version_id).toBe(v1.document_version_id);
  });
  it('historical snapshots remain inaccessible to an actor of another study despite known IDs',()=>{
    const doc=syntheticDocument({document_id:'private',source_type:'PRIVATE_MATTER'}),index=new LocalEvidenceIndex([doc]);
    const snapshot=index.snapshot(DEMO_ACTOR,scope),foreign={...DEMO_ACTOR,study_id:'foreign'};
    expect(()=>index.documents(foreign,{...scope,study_id:'foreign'},snapshot)).toThrow('SNAPSHOT_SCOPE_OR_HASH_INVALID');
    expect(()=>index.passage(foreign,{...scope,study_id:'foreign'},snapshot,doc.document_id,doc.text_spans[0]!.passage_id)).toThrow();
  });
  it('two private versions for another matter do not require publication in this matter',()=>{
    const documents=[v1,v2].map(d=>({...d,source_type:'PRIVATE_MATTER' as const,study_id:DEMO_ACTOR.study_id,matter_id:'other-matter'}));
    const index=new LocalEvidenceIndex(documents);expect(index.snapshot(DEMO_ACTOR,scope).documents).toEqual([]);
  });
});

describe('Phase 2 A1 J-004 full auditor payload and truthful coverage',()=>{
  it('free prose and structured references remain intact together in auditor input',async()=>{
    const h=harness(),sol=h.providers.sol.invoke.bind(h.providers.sol),text='Texto de control '.repeat(1000);
    vi.spyOn(h.providers.sol,'invoke').mockImplementation(async(c,s)=>{const r=await sol(c,s);r.output.legal_analysis=text;return r;});
    const invoke=vi.spyOn(h.providers.gemini,'invoke'),run=await h.board.execute(h.actor,h.request,h.snapshot);
    expect(run.status).toBe('HUMAN_REVIEW_PENDING');
    const payload=invoke.mock.calls[0]![0].payload as {input:{analysis:PrincipalAnalysis}};
    expect(payload.input.analysis.legal_analysis).toBe(text);expect(payload.input.analysis.supporting_references).toEqual(run.analysis!.supporting_references);
  });
  it('an oversized auditor input cannot leave a passed adversarial stage or a human-ready result',async()=>{
    const h=harness();Object.defineProperty(h.providers.gemini,'max_input_tokens',{value:1});
    const invoke=vi.spyOn(h.providers.gemini,'invoke'),run=await h.board.execute(h.actor,h.request,h.snapshot);
    expect(invoke).not.toHaveBeenCalled();expect(run.status).toBe('PARTIAL');expect(run.audit).toBeNull();
    expect(run.history).not.toContain('HUMAN_REVIEW_PENDING');
    expect(run.stages.some(s=>s.stage_name==='ADVERSARIAL_AUDIT' && s.status==='PASS')).toBe(false);
  });
});
