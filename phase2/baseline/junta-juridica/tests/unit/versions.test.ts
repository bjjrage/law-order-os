import { describe,it,expect } from 'vitest';
import { LocalEvidenceIndex } from '../../src/retrieval/index.js';
import { syntheticDocument,DEMO_ACTOR } from '../fixtures/index.js';

describe('J-003 authoritative current version',()=>{
  const scope={study_id:DEMO_ACTOR.study_id,matter_id:'asunto-demo'};
  const v1=syntheticDocument({document_id:'same',document_version_id:'same:v1'},'old');
  const v2=syntheticDocument({document_id:'same',document_version_id:'same:v2'},'new');
  it.each([[v2,v1],[v1,v2]])('multiple versions require publication regardless of insertion order',(a,b)=>{
    const index=new LocalEvidenceIndex([a,b]);expect(()=>index.snapshot(DEMO_ACTOR,scope)).toThrow('CURRENT_DOCUMENT_VERSION_REQUIRED');
    index.publishVersion('same','same:v2');expect(index.snapshot(DEMO_ACTOR,scope).documents[0]!.document_version_id).toBe('same:v2');
  });
  it('explicit heads produce identical snapshots for reordered loads',()=>{
    const heads={same:'same:v2'};
    expect(new LocalEvidenceIndex([v1,v2],undefined,heads).snapshot(DEMO_ACTOR,scope)).toEqual(new LocalEvidenceIndex([v2,v1],undefined,heads).snapshot(DEMO_ACTOR,scope));
  });
  it('loading an older version cannot silently replace a published current version',()=>{
    const index=new LocalEvidenceIndex([v2]);index.publishVersion('same','same:v2');const before=index.snapshot(DEMO_ACTOR,scope);
    index.add(v1);expect(index.snapshot(DEMO_ACTOR,scope)).toEqual(before);
  });
  it('arbitrary version names convey no chronological authority',()=>{
    const first=syntheticDocument({document_id:'same',document_version_id:'zzz'},'old');
    const current=syntheticDocument({document_id:'same',document_version_id:'aaa'},'new');
    const index=new LocalEvidenceIndex([current,first],undefined,{same:'aaa'});
    expect(index.snapshot(DEMO_ACTOR,scope).documents[0]!.document_version_id).toBe('aaa');
  });
  it('rejects missing and cross-document publication targets',()=>{
    const index=new LocalEvidenceIndex([v1,v2]);expect(()=>index.publishVersion('same','missing')).toThrow('CURRENT_DOCUMENT_VERSION_NOT_REGISTERED');
    expect(()=>index.publishVersion('other','same:v2')).toThrow('CURRENT_DOCUMENT_VERSION_NOT_REGISTERED');
  });
  it('republication keeps historical snapshots and locators usable',()=>{
    const index=new LocalEvidenceIndex([v1,v2],undefined,{same:'same:v1'}),old=index.snapshot(DEMO_ACTOR,scope);
    index.publishVersion('same','same:v2');expect(index.snapshot(DEMO_ACTOR,scope).hash).not.toBe(old.hash);
    expect(index.documents(DEMO_ACTOR,scope,old)[0]!.document_version_id).toBe('same:v1');
    expect(index.passage(DEMO_ACTOR,scope,old,'same','same:v1:p1').text).toBe('old');
  });
  it('foreign private version ambiguity cannot block an authorized matter',()=>{
    const foreign=[v1,v2].map(d=>({...d,source_type:'PRIVATE_MATTER' as const,study_id:'foreign',matter_id:'foreign'}));
    const own=syntheticDocument({document_id:'own'});const index=new LocalEvidenceIndex([...foreign,own]);
    expect(index.snapshot(DEMO_ACTOR,scope).documents.map(d=>d.document_id)).toEqual(['own']);
  });
});
