import {expect,it} from 'vitest';
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {handleJunta} from '../../scripts/junta-bridge.mjs';
it('shows automatic library loading, a paged catalog and a retrieved PDF with its current extraction status without spending',async()=>{
 const origin='http://127.0.0.1:4316',root=resolve('dist/web');let browser;
 const server=createServer(async(req,res)=>{
  if(await handleJunta(req,res,origin))return;
  try{let path=resolve(root,'.'+new URL(req.url,origin).pathname);if(path!==root&&!path.startsWith(root+sep))throw Error();if(!extname(path))path=resolve(root,'index.html');res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':extname(path)==='.css'?'text/css':'text/html');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}
 });
 try{
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(4316,'127.0.0.1',done);});
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1366,height:900}}),requests=[],errors=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());requests.push(url.href);return url.origin===origin?route.continue():route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.getByRole('button',{name:'Biblioteca jurídica',exact:true}).click();
  await page.getByRole('heading',{name:'Encontrá el respaldo de tu trabajo',exact:true}).waitFor();
  await page.getByRole('region',{name:'Carga automática de la Biblioteca'}).waitFor();
  const searchResponse=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/local/junta/library/search'&&url.searchParams.get('q')==='Decreto 4777';});
  await page.getByRole('textbox',{name:'Buscar documentos jurídicos',exact:true}).fill('Decreto 4777');
  const research=await (await searchResponse).json(),selected=research.sources.find(source=>source.title.includes('4777'));
  expect(selected).toBeDefined();
  await page.getByRole('heading',{name:'Coincidencias en el texto oficial',exact:true}).waitFor();
  const source=page.locator('.junta-sources .research-source').filter({hasText:'4777'}).first();await source.locator('summary').click();
  // The live ingestion may replace an OCR derivative with digital text. Assert the actual
  // extraction state instead of falsely requiring this specific decree to remain scanned.
  if(selected.extraction_status==='OCR_TEXT_UNREVIEWED')await source.getByText('Texto recuperado de un PDF escaneado mediante lectura automática. Cotejá las citas, nombres y cifras con el original.',{exact:true}).waitFor();
  else if(selected.extraction_status==='PARTIAL_TEXT_UNREVIEWED')await source.getByText('Lectura parcial del documento.',{exact:false}).waitFor();
  else {expect(selected.extraction_status).toBe('DIGITAL_TEXT_UNREVIEWED');expect(await source.innerText()).not.toContain('Texto recuperado de un PDF escaneado');}
  expect(await source.innerText()).toContain('Página');expect(await page.locator('.library-documents table tbody tr').count()).toBeLessThanOrEqual(50);
  expect(requests.some(u=>/\/case\/(consult|run)$/.test(u))).toBe(false);expect(requests.every(u=>new URL(u).origin===origin)).toBe(true);expect(errors).toEqual([]);
  await mkdir('junta-local/reports',{recursive:true});await page.screenshot({path:'junta-local/reports/full-library-source-browser.png',fullPage:true});
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
});
