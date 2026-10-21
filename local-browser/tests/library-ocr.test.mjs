import {expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {LocalOcr,extractPdf,acceptableOcr,usableDigitalText} from '../../scripts/library-ocr.mjs';
import {CorpusStore,sha} from '../../scripts/library-corpus-store.mjs';
import {researchCase,researchContext} from '../../scripts/library-research.mjs';
import {LibraryResearchSchema} from '../../dist/providers/contracts.js';
const require=createRequire(new URL('../../phase2/tooling/package.json',import.meta.url));
const {createCanvas}=require('@napi-rs/canvas');
function imagePdf(jpeg){
 const blocks=[Buffer.from('%PDF-1.4\n')],offsets=[0];let length=blocks[0].length;
 const add=(id,body)=>{offsets[id]=length;const b=Buffer.concat([Buffer.from(id+' 0 obj\n'),Buffer.isBuffer(body)?body:Buffer.from(body),Buffer.from('\nendobj\n')]);blocks.push(b);length+=b.length;};
 add(1,'<< /Type /Catalog /Pages 2 0 R >>');add(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 add(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 400] /Resources << /XObject << /Img 4 0 R >> >> /Contents 5 0 R >>');
 add(4,Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width 1600 /Height 800 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n'),jpeg,Buffer.from('\nendstream')]));
 const content='q 800 0 0 400 0 0 cm /Img Do Q';add(5,'<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream');
 blocks.push(Buffer.from('xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+length+'\n%%EOF'));return Buffer.concat(blocks);
}
it('reads an image-only PDF in Spanish locally, caches page OCR, preserves originals and passes scan warnings to the real RAG',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'law-order-ocr-'));let ocr,db;
 try{
  const dir=resolve(root,'local-browser/library/research');await mkdir(resolve(dir,'ocr/lang'),{recursive:true});
  await writeFile(resolve(dir,'ocr/lang/spa.traineddata.gz'),await readFile('local-browser/library/research/ocr/lang/spa.traineddata.gz'));
  const canvas=createCanvas(1600,800),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1600,800);ctx.fillStyle='black';ctx.font='40px Arial';
  ['CONTRATO DE PRUEBA - DOCUMENTO SINTETICO','La notificación del contrato debe documentarse por escrito.','El aviso de finalización requiere revisar las obligaciones.','Este texto es ficticio y no corresponde a personas reales.'].forEach((line,i)=>ctx.fillText(line,60,120+i*100));
  const bytes=imagePdf(canvas.toBuffer('image/jpeg')),original=sha(bytes);ocr=new LocalOcr(root);
  const result=await extractPdf(bytes,{root,ocr});expect(result.extraction_status).toBe('OCR_TEXT_UNREVIEWED');expect(result.pages[0].text).toContain('CONTRATO');expect(result.ocr.pages_processed).toBe(1);expect(sha(bytes)).toBe(original);
  const reject=vi.fn(()=>{throw Error('OCR SHOULD BE CACHED');});await extractPdf(bytes,{root,ocr:{recognize:reject}});expect(reject).not.toHaveBeenCalled();
  db=new CorpusStore(resolve(dir,'corpus.sqlite'));db.upsert({id:'scan-contract',title:'Contrato sintético para probar lectura de escaneos',url:'https://www.pj.gov.py/test.pdf',publisher:'TEST ONLY',kind:'LEGISLATION',document_type:'Ley',publication_kind:'TEST ONLY',original_sha256:original,extraction_sha256:sha(JSON.stringify(result.pages)),fetched_at:new Date().toISOString(),content_format:'PDF',...result});
  const r=await researchCase(root,'Notificación del contrato y aviso de finalización','','','2026-10-14');expect(r.retrieval.engine).toBe('SQLITE_FTS5_BM25');expect(r.sources[0].extraction_status).toBe('OCR_TEXT_UNREVIEWED');expect(LibraryResearchSchema.parse(researchContext(r)).sources[0].extraction_status).toBe('OCR_TEXT_UNREVIEWED');
 }finally{await ocr?.close();db?.close();if(!resolve(root).startsWith(resolve(tmpdir())+sep+'law-order-ocr-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}
},60000);
it('keeps low-confidence OCR out of the searchable body and treats short stamps as insufficient digital text',()=>{
 expect(acceptableOcr('texto '.repeat(100),30)).toBe(false);expect(acceptableOcr('texto '.repeat(100),92)).toBe(true);expect(usableDigitalText('Firmado digitalmente. Página 2.')).toBe(false);
});
