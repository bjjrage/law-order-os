import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { getDocument, version } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

// Local-only review. Never alters original PDF bytes, executes actions or uses OCR.
const sha256 = data => createHash('sha256').update(data).digest('hex');
const ids = ['csj-constitucional-1010-2015','csj-civil-1184-2013','csj-penal-162-2023'];
mkdirSync('phase2/corpus/extracted',{recursive:true});
mkdirSync('phase2/corpus/review-images',{recursive:true});
const results=[];
for(const id of ids){
  const path=resolve('phase2/corpus/originals/'+id+'.pdf');
  const original=readFileSync(path);
  const task=getDocument({data:new Uint8Array(original),isEvalSupported:false,useSystemFonts:true});
  const pdf=await task.promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i),content=await page.getTextContent();
    let text='';
    for(const item of content.items)if('str' in item)text+=item.str+(item.hasEOL?'\n':' ');
    pages.push({page:i,text,text_items:content.items.filter(item=>'str' in item).map(item=>({text:item.str,transform:item.transform,width:item.width,height:item.height,has_eol:item.hasEOL}))});
  }
  const record={source_document_id:id,original_sha256:sha256(original),parser:'Mozilla PDF.js',parser_version:version,
    page_count:pdf.numPages,extraction_status:pages.some(p=>p.text.trim())?'DIGITAL_TEXT_UNREVIEWED':'IMAGE_ONLY_OCR_NOT_RUN',
    extraction_is_original:false,ocr_used:false,signature_validation:'NOT_RUN',pages};
  const extraction=JSON.stringify(record,null,2);
  writeFileSync('phase2/corpus/extracted/'+id+'.json',extraction);
  const images=[];
  for(const pageNumber of [...new Set([1,pdf.numPages])]){
    const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1.4});
    const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const imagePath='phase2/corpus/review-images/'+id+'-p'+pageNumber+'.png';
    writeFileSync(imagePath,canvas.toBuffer('image/png'));images.push(imagePath);
  }
  results.push({source_document_id:id,original_sha256:sha256(original),extraction_sha256:sha256(Buffer.from(extraction)),page_count:pdf.numPages,
    extraction_status:record.extraction_status,extracted_characters:pages.reduce((n,p)=>n+p.text.length,0),review_images:images});
  await task.destroy();
}
writeFileSync('phase2/reports/pdf-review.json',JSON.stringify({tool:'NODE_PDFJS_LOCAL',python_used:false,network_used:false,documents:results},null,2));
console.log(JSON.stringify(results,null,2));
