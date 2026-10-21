import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {getDocument,OPS} from '../phase2/tooling/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import {sha} from './library-corpus-store.mjs';
import {atomicLibraryJson} from './library-atomic.mjs';
const require=createRequire(new URL('../phase2/tooling/package.json',import.meta.url));
const {createCanvas}=require('@napi-rs/canvas');
const {createWorker}=require('tesseract.js');
const engineVersion=require('tesseract.js/package.json').version;
export function usableDigitalText(text){return text.replace(/\s/g,'').length>=160&&(text.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/g)?.length??0)>=25;}
export function acceptableOcr(text,confidence){return Number.isFinite(confidence)&&confidence>=55&&text.replace(/\s/g,'').length>=100;}
export class LocalOcr {
  constructor(root){this.root=root;this.worker=null;}
  async recognize(image){
    if(!this.worker){
      const dir=resolve(this.root,'local-browser/library/research/ocr');await mkdir(resolve(dir,'cache'),{recursive:true});
      // Both the engine and traineddata are local; no document is uploaded.
      await readFile(resolve(dir,'lang/spa.traineddata.gz'));
      this.worker=await createWorker('spa',1,{langPath:resolve(dir,'lang'),cachePath:resolve(dir,'cache'),gzip:true,logger:()=>{},errorHandler:()=>{}});
      await this.worker.setParameters({tessedit_pageseg_mode:'3',user_defined_dpi:'180',preserve_interword_spaces:'1'});
    }
    let timer;
    try{return await Promise.race([this.worker.recognize(image),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OCR_PAGE_TIMEOUT')),120000);})]);}
    catch(e){await this.close();throw e;}
    finally{clearTimeout(timer);}
  }
  async close(){const worker=this.worker;this.worker=null;if(worker)await worker.terminate();}
}
export async function extractPdf(bytes,{root,ocr,originalHash=sha(bytes),onPage=()=>{},forceOcr=false}={}){
  const assetRoot=fileURLToPath(new URL('../phase2/tooling/node_modules/pdfjs-dist/',import.meta.url));
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true,standardFontDataUrl:assetRoot.replace(/\\/g,'/')+'/standard_fonts/',wasmUrl:assetRoot.replace(/\\/g,'/')+'/wasm/'});
  const cacheDir=resolve(root,'local-browser/library/research/ocr/pages');await mkdir(cacheDir,{recursive:true});
  const pages=[],unreadable=[],ocrPages=[];let numPages=0;
  try{
    const pdf=await task.promise;numPages=pdf.numPages;if(numPages>5000)throw Error('DOCUMENT_PAGE_LIMIT');
    for(let number=1;number<=numPages;number++){
      const page=await pdf.getPage(number),content=await page.getTextContent();
      const digital=content.items.filter(i=>'str' in i).map(i=>i.str+(i.hasEOL?'\n':' ')).join('');
      let scan=forceOcr||!usableDigitalText(digital);
      if(!scan&&digital.length<500){const operators=await page.getOperatorList();scan=operators.fnArray.some(op=>[OPS.paintImageXObject,OPS.paintInlineImageXObject].includes(op));}
      let result={page:number,text:digital,extraction_method:'DIGITAL',ocr_confidence:null};
      if(scan&&ocr){
        const key=sha(JSON.stringify({originalHash,number,engineVersion,language:'spa',scale:2.5,policy:2}));
        const file=resolve(cacheDir,key+'.json');let saved=JSON.parse(await readFile(file,'utf8').catch(()=>'null'));
        if(!saved){
          onPage({page:number,total:numPages,stage:'OCR'});
          const originalViewport=page.getViewport({scale:2.5});const scale=Math.min(2.5,2.5*Math.sqrt(12_000_000/(originalViewport.width*originalViewport.height)));
          const viewport=page.getViewport({scale}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
          try{
            await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
            const {data}=await ocr.recognize(canvas.toBuffer('image/png'));
            saved={text:data.text,confidence:data.confidence,engine:'Tesseract.js '+engineVersion,language:'spa',original_sha256:originalHash,page:number};
            await atomicLibraryJson(file,saved);
          }finally{canvas.width=1;canvas.height=1;}
        }
        ocrPages.push({page:number,confidence:saved.confidence});
        if(acceptableOcr(saved.text,saved.confidence))result={page:number,text:saved.text,extraction_method:'OCR',ocr_confidence:saved.confidence};
        else{if(!usableDigitalText(digital))result={page:number,text:'',extraction_method:'UNREADABLE',ocr_confidence:saved.confidence};unreadable.push(number);}
      }else if(scan){if(!usableDigitalText(digital)){result.text='';result.extraction_method='UNREADABLE';}unreadable.push(number);}
      pages.push(result);page.cleanup();onPage({page:number,total:numPages,stage:'EXTRACTED',ocr:result.extraction_method==='OCR'});
    }
    if(!pages.some(p=>p.text.trim().length>=100))throw Error(ocr?'OCR_REVIEW_REQUIRED':'IMAGE_ONLY_NO_OCR');
    return {pages,extraction_status:unreadable.length?'PARTIAL_TEXT_UNREVIEWED':ocrPages.length?'OCR_TEXT_UNREVIEWED':'DIGITAL_TEXT_UNREVIEWED',ocr:{engine:'Tesseract.js '+engineVersion,language:'spa',pages_processed:ocrPages.length,unreadable_pages:unreadable,confidence_by_page:ocrPages}};
  }finally{await task.destroy();}
}
