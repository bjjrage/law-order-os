import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { lawRecords, jurisprudenceRecords, safeOfficialUrl } from '../../scripts/library-sync.mjs';

it('imports official legislation without inventing years or conflating project and law identifiers',()=>{
  const [row]=lawRecords({codigoEstado:200,datos:[{idLey:42,numeroLey:'123',appURL:'https://silpy.congreso.gov.py/ley/42',fechaPromulgacion:'03/01/0013',proyecto:{idProyecto:99,acapite:'<b>Contrato</b>'}}]});
  expect(row.id).toBe('congreso-ley-42');expect(row.title).toBe('Contrato');expect(row.year).toBe('');expect(row.notes).toContain('inconsistente');expect(row.text_indexed).toBe(false);
  expect(()=>lawRecords({codigoEstado:500,datos:[]})).toThrow();
  expect(()=>lawRecords({codigoEstado:200,datos:[{idLey:42,numeroLey:'123',appURL:'javascript:alert(1)'}]})).toThrow();
  expect(safeOfficialUrl('https://silpy.congreso.gov.py.evil.test/ley/42',['silpy.congreso.gov.py'])).toBe(null);
});
it('imports only documented judicial PDF references, deduplicates and retains limited verification scope',()=>{
  const a='<a href="https://digestolegislativo.gov.py/archivos/file/24-2017.pdf">Acuerdo y Sentencia N&ordm; 24 del 2017</a>';
  const rows=jurisprudenceRecords(a+a+'<a href="https://evil.test/fake.pdf">Acuerdo y Sentencia 99</a>');
  expect(rows).toHaveLength(1);expect(rows[0].number).toBe('24');expect(rows[0].year).toBe('2017');expect(rows[0].notes).toContain('pendientes');expect(rows[0].text_indexed).toBe(false);
});
it('publishes unique references with provenance and explicit coverage, without altering trusted Junta corpus',async()=>{
  const c=JSON.parse(await readFile('apps/web/public/library/catalog.json','utf8'));
  expect(c.records.length).toBeGreaterThan(5000);
  expect(new Set(c.records.map(r=>r.id)).size).toBe(c.records.length);
  expect(c.records.filter(r=>r.type==='Ley').length).toBeGreaterThanOrEqual(4360);
  expect(c.records.filter(r=>r.type==='Jurisprudencia').length).toBeGreaterThanOrEqual(925);
  expect(c.records.filter(r=>r.type==='Decreto').length).toBeGreaterThan(0);
  expect(c.coverage.full_text_search).toBe(true);expect(c.coverage.junta_connected).toBe(true);
  const textIndex=JSON.parse(await readFile('apps/web/public/library/research-coverage.json','utf8'));
  expect(textIndex.sources.length).toBeGreaterThan(7);expect(textIndex.sources.every(s=>s.page_count>0&&/^[a-f0-9]{64}$/.test(s.original_sha256))).toBe(true);
  // Recovered provenance is retained in the canonical database even while an
  // already-running legacy publisher refreshes its older display snapshot.
  let provenance=c.provenance;
  if(!provenance){const db=new DatabaseSync('local-browser/library/research/corpus.sqlite',{readOnly:true});try{const row=db.prepare('SELECT value FROM job_state WHERE id=?').get('archive:catalog-provenance');provenance=row?JSON.parse(row.value):null;}finally{db.close();}}
  expect(provenance?.law_pages).toHaveLength(9);expect(c.records.some(r=>r.text_indexed===true)).toBe(true);
});
