import { expect, it } from 'vitest';
import { duration,legalSections,legalDocumentHtml,legalDocumentMarkdown,sourcesHtml,sourcesMarkdown } from '../../apps/web/src/junta-presentation.js';
it('structures the saved legal analysis without changing claims or manufacturing a conclusion',()=>{
  const text='Criterio limitado al relato.\n\n1. Documentación decisiva: Falta el contrato firmado.\n\n2. Pagos discutidos: No se acredita deuda.\n\nNo permite concluir incumplimiento.';
  const p=legalSections(text);
  expect(p.map(x=>x.kind)).toEqual(['lead','section','section','conclusion']);
  expect(p[1]).toMatchObject({title:'Documentación decisiva',text:'Falta el contrato firmado.'});
  expect(p[2]?.text).toBe('No se acredita deuda.');
  expect(legalSections('Único párrafo sin conclusión separada.')).toHaveLength(1);
});
it('retains incomplete scan warnings in downloaded reports and identifies HTML articles without inventing PDF pages',()=>{
 const research={searched_at:'2026-10-14',as_of_date:'2026-10-14',indexed_sources:1,catalog_records:1,sources:[{source_id:'test',title:'Texto sintético',url:'https://www.bacn.gov.py/test',publisher:'TEST',kind:'LEGISLATION',publication_kind:'TEST',use:'PROVIDED',content_format:'HTML' as const,extraction_status:'PARTIAL_TEXT_UNREVIEWED',unreadable_pages:[2,4],excerpts:[{page:1,text:'Texto de prueba.',passage_id:'test:p1:0',locator:'Artículo 9'}]}],located:[],limitations:[]};
 for(const body of [sourcesHtml(research),sourcesMarkdown(research)]){expect(body).toContain('Lectura parcial');expect(body).toContain('2, 4');expect(body).toContain('Artículo 9');expect(body).not.toContain('Página 1 del PDF');}
});
it('exports safe readable legal documents retaining limits, reviewer observations and measured time',()=>{
  const r={question:'<script>alert(1)</script>',analysis:{legal_analysis:'Revisión preliminar.\n\n1. Contrato: No aportado.\n\nNo se acredita pago.',limitations:['Sin fuentes oficiales.'],unresolved_issues:[]},audit:{findings:[{statement:'Falta evidencia.',recommended_action:'Solicitar el original.'}]},cost:{estimated_total_usd:0.050737152},timing:{elapsed_ms:118093.5,source:'LOCAL_PERSISTENCE_TIMESTAMPS'}};
  const html=legalDocumentHtml(r);expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('<h2>1. Contrato</h2>');expect(html).toContain('Sin fuentes oficiales.');expect(html).toContain('Solicitar el original.');
  const md=legalDocumentMarkdown(r);expect(md).toContain('## 1. Contrato');expect(md).toContain('No se acredita pago.');expect(md).toContain('USD 0.05074');expect(md).toContain('01:58');
  expect(duration(114276)).toBe('01:54');expect(duration(-100)).toBe('00:00');
});
