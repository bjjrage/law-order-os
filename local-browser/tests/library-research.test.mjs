import {expect,it} from 'vitest';
import {officialUrl,searchResearch,researchContext,researchUsage} from '../../scripts/library-research.mjs';
import {LibraryResearchSchema} from '../../dist/providers/contracts.js';
import {sourcesHtml,sourcesMarkdown} from '../../apps/web/src/junta-presentation.ts';
import {fixtureSource} from './library-fixtures.mjs';
it('retrieves genuine stored excerpts by page, separates title-only hits and excludes unsafe/future sources',()=>{
 const source={...fixtureSource,kind:'LEGISLATION',id:'civil'};
 const index={sources:[source,fixtureSource,{...source,id:'future',published_date:'2027-01-01'},{...source,id:'unsafe',url:'http://127.0.0.1/admin'}]};
 const catalog={records:[{id:'title-only',title:'Contrato servicios rescisión',url:'https://silpy.congreso.gov.py/ley/1',year:'2020',type:'Ley'}]};
 const r=searchResearch(index,catalog,'¿Qué documentación falta para revisar la rescisión del contrato de servicios?','','','2026-10-14');
 expect(r.sources.map(s=>s.source_id)).toEqual(['civil','official-services']);expect(r.located[0].use).toBe('LOCATED_ONLY');
 expect(r.sources[0].excerpts[0]).toMatchObject({page:99,text:fixtureSource.pages[0].text});
 expect(LibraryResearchSchema.parse(researchContext(r)).sources).toHaveLength(2);
 expect(researchContext(r)).not.toHaveProperty('located');
 expect(officialUrl('https://www.pj.gov.py@evil.example/test')).toBeNull();expect(officialUrl('https://www.pj.gov.py:9999/test')).toBeNull();expect(officialUrl('file:///C:/secret')).toBeNull();
});
it('reports no matching jurisprudence honestly instead of filling the result with unrelated links',()=>{
 const r=searchResearch({sources:[fixtureSource]},{records:[]},'Protección de patentes aeroespaciales y nanotecnología','','','2026-10-14');
 expect(r.sources).toHaveLength(0);expect(r.limitations.some(s=>s.includes('No se encontró jurisprudencia'))).toBe(true);
});
it('traces citation IDs to the frozen source, checks quotes and exports safe clickable provenance',()=>{
 const r=searchResearch({sources:[fixtureSource]},{records:[]},'Rescisión del contrato de servicios y aviso','','','2026-10-14');
 const s=r.sources[0];const ref={source_id:s.source_id,document_version_id:s.version_id,passage_id:s.excerpts[0].passage_id,raw_text:'Referencia sintética <script>fake</script>',quote:'Contrato de servicios.'};
 const run={stages:[{stage_name:'PRINCIPAL_ANALYSIS',status:'PASS'}],analysis:{supporting_references:[ref]}};
 const used=researchUsage(r,run);expect(used.sources[0]).toMatchObject({use:'CITED',citations:[{quote_match:true,page:99}]});
 expect(researchUsage(r,{...run,analysis:{supporting_references:[{...ref,quote:'TEXTO INVENTADO'}]}}).sources[0].citations[0].quote_match).toBe(false);
 expect(researchUsage(r,{...run,analysis:{supporting_references:[{...ref,document_version_id:'b'.repeat(64)}]}}).sources[0].use).toBe('PROVIDED');
 expect(researchUsage(r,null).sources[0].use).toBe('NOT_SUPPLIED');
 const html=sourcesHtml(used);expect(html).toContain('https://www.pj.gov.py/ebook/test.pdf');expect(html).toContain('Página 99');expect(html).toContain('pendiente de cotejo');expect(html).not.toContain('<script>');
 expect(sourcesMarkdown(used)).toContain('Fuente oficial: https://www.pj.gov.py/ebook/test.pdf');
});
