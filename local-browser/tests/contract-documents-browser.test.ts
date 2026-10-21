import { expect, it } from 'vitest';
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';

function pdfFixture() {
  const stream = (lines: string[]) => 'BT /F1 10 Tf 50 740 Td 14 TL\n' + lines.map(line => '(' + line.replace(/[\\()]/g, '\\$&') + ') Tj T*').join('\n') + '\nET';
  const first = stream(['CONTRATO SINTETICO PDF', 'El proveedor debera entregar solamente si recibe la orden.', 'Salvo demora documentada, se conserva la excepcion.']);
  const last = stream(['ANEXO CONTRACTUAL', 'CLAUSULA FINAL PDF: debera entregar el Anexo Z si lo solicita el cliente.']);
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(first)} >>\nstream\n${first}\nendstream`, `<< /Length ${Buffer.byteLength(last)} >>\nstream\n${last}\nendstream`];
  let pdf = '%PDF-1.4\n%' + 's'.repeat(90000) + '\n'; const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const start = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf);
}
function docxFixture() {
  const body = '<w:p><w:r><w:t>Antecedente contractual completo sin inferencias.</w:t></w:r></w:p>'.repeat(1400) + '<w:p><w:r><w:t>CLÁUSULA FINAL WORD: deberá entregar si recibe la orden. Salvo excepción expresa.</w:t></w:r></w:p>';
  return Buffer.from(zipSync({ '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'), '_rels/.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'), 'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '</w:body></w:document>') }, { level: 0 }));
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const raw = localStorage.getItem('law-order-os.local.v1')!, pointer = JSON.parse(raw);
    if (pointer.format !== 'LAW_ORDER_IDB_POINTER') return pointer;
    return new Promise<any>((resolve, reject) => { const open = indexedDB.open('law-order-os.documents.v1', 1); open.onsuccess = () => { const db = open.result, read = db.transaction('snapshots').objectStore('snapshots').get(pointer.key); read.onsuccess = () => { db.close(); resolve(JSON.parse(read.result)); }; read.onerror = () => reject(read.error); }; open.onerror = () => reject(open.error); });
  });
}
it('uploads normal-size PDF/DOCX/TXT, executes their complete extracted text, preserves original bytes, survives disk migration and reload offline', async () => {
  const report = 'local-browser/reports/contract-documents'; await mkdir(report, { recursive: true });
  const server = createServer(async (req, res) => { try { const path = new URL(req.url!, 'http://127.0.0.1').pathname, file = resolve('dist/web', '.' + (extname(path) ? path : '/index.html')); res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream'); res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'"); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); } });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done)); const address = server.address(); if (!address || typeof address === 'string') throw Error('No port'); const origin = 'http://127.0.0.1:' + address.port;
    browser = await chromium.launch({ channel: 'msedge', headless: true }); const context = await browser.newContext({ viewport: { width: 1366, height: 900 } }), page = await context.newPage(); page.setDefaultTimeout(15000);
    const external: string[] = [], errors: string[] = [];
    await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin || /^\/(api|local)\//u.test(url.pathname)) { external.push(url.href); return route.abort(); } return route.continue(); }); page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin); await page.getByRole('button', { name: 'Administración', exact: true }).click(); await page.getByRole('button', { name: 'Crear estudio', exact: true }).click(); await page.getByLabel('Nombre del estudio sintético').fill('Estudio de contratos sintéticos'); await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      await page.getByRole('button', { name: 'Dashboard', exact: true }).click(); await page.getByLabel('Describí tu encargo sintético').fill('Revisar un contrato completo con sus condiciones y anexos.'); await page.getByRole('button', { name: /Proponer equipo/ }).click();
      await page.getByRole('button', { name: 'Nuevo cliente aquí', exact: true }).click(); await page.getByLabel('Nombre del cliente nuevo').fill('Cliente de contratos sintéticos'); await page.getByLabel('Título del encargo').fill('Contrato completo PDF y Word'); await page.getByLabel('Confirmo que el encargo contiene datos sintéticos.').check(); await page.getByRole('button', { name: 'Confirmar equipo y abrir asunto', exact: true }).click();
      await page.getByLabel('Confirmo datos sintéticos para este encargo local.', { exact: true }).check();
      const pdf = pdfFixture(), docx = docxFixture(), txt = Buffer.from('Contexto documental sintético sin inferencias.\n'.repeat(900) + 'CLÁUSULA FINAL TXT: deberá entregar si recibe el informe.');
      expect(pdf.length).toBeGreaterThan(24576); expect(docx.length).toBeGreaterThan(24576); expect(txt.length).toBeGreaterThan(24576);
      await page.getByLabel('Adjuntar documentos a la consulta').setInputFiles([{ name: 'Contrato completo.pdf', mimeType: 'application/pdf', buffer: pdf }, { name: 'Contrato completo.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx }, { name: 'Contrato completo.txt', mimeType: 'text/plain', buffer: txt }]);
      await page.getByText('3 documentos incorporados al asunto y seleccionados para la consulta.', { exact: true }).waitFor();
      const uploaded = await snapshot(page); expect(uploaded.legal_team.document_extractions).toHaveLength(3);
      for (const extraction of uploaded.legal_team.document_extractions) expect(extraction.status).toBe('COMPLETE_UNREVIEWED');
      expect(uploaded.legal_team.document_extractions.find((e: any) => e.format === 'pdf').units).toHaveLength(2);
      expect(uploaded.legal_team.document_extractions.find((e: any) => e.format === 'pdf').text).toContain('CLAUSULA FINAL PDF');
      expect(uploaded.legal_team.document_extractions.find((e: any) => e.format === 'docx').text).toContain('CLÁUSULA FINAL WORD');
      await page.getByRole('button', { name: 'Preparar consulta', exact: true }).click(); await page.getByText('Equipo, cuestiones y evidencia preparados.', { exact: false }).waitFor(); await page.getByRole('button', { name: 'Ejecutar encargo local · USD 0', exact: true }).click(); await page.getByRole('region', { name: 'Documento de trabajo' }).waitFor();
      const completed = await snapshot(page), run = completed.legal_team.runs[0]; expect(run.final_markdown).toContain('CLAUSULA FINAL PDF'); expect(run.final_markdown).toContain('CLÁUSULA FINAL WORD'); expect(run.final_markdown).toContain('CLÁUSULA FINAL TXT');
      const originalDownload = page.waitForEvent('download'); await page.locator('.evidence-document').filter({ hasText: 'PDF' }).getByRole('button', { name: 'Descargar original', exact: true }).click(); const downloaded = await originalDownload;
      expect(downloaded.suggestedFilename()).toBe('Contrato completo.pdf'); expect(await readFile((await downloaded.path())!)).toEqual(pdf);
      await page.screenshot({ path: report + '/contract-loaded.png', fullPage: true });
      // A multi-megabyte original must not hit localStorage quota or disappear on reload.
      await page.locator('input[aria-label="Adjuntar documentos a la consulta"]:enabled').waitFor({ state: 'attached' });
      const large = Buffer.from('Documento documental de tamaño normal, texto conservado.\n'.repeat(45000) + 'ULTIMA LINEA DEL ORIGINAL GRANDE.');
      expect(large.length).toBeGreaterThan(2 * 1024 * 1024);
      await page.getByLabel('Adjuntar documentos a la consulta').setInputFiles({ name: 'Contrato extenso.txt', mimeType: 'text/plain', buffer: large }); await page.getByText('1 documento incorporado al asunto y seleccionado para la consulta.', { exact: true }).waitFor();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('law-order-os.local.v1')!).format)).toBe('LAW_ORDER_IDB_POINTER');
      await page.reload(); await page.getByRole('button', { name: /Contrato completo PDF y Word/ }).click(); await page.getByText('Contrato extenso', { exact: true }).waitFor();
      const restored = await snapshot(page); const largeVersion = restored.tables.documentVersions.find((v: any) => v.original_filename === 'Contrato extenso.txt'); expect(createHash('sha256').update(Buffer.from(largeVersion.original_base64, 'base64')).digest('hex')).toBe(createHash('sha256').update(large).digest('hex')); expect(restored.legal_team.runs[0].id).toBe(run.id);
      const backupDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar respaldo', exact: true }).click(); const backup = await backupDownload, exported = JSON.parse(await readFile((await backup.path())!, 'utf8')); expect(exported.format).toBe('LAW_ORDER_LOCAL'); expect(exported.tables.documentVersions).toHaveLength(4); expect(exported.legal_team.document_extractions).toHaveLength(4);
      const restoredContext = await browser.newContext(), importedPage = await restoredContext.newPage(); importedPage.setDefaultTimeout(15000);
      importedPage.on('dialog', dialog => dialog.accept()); await importedPage.goto(origin);
      await importedPage.getByLabel('Importar respaldo', { exact: true }).setInputFiles({ name: 'respaldo-contratos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
      await importedPage.getByRole('button', { name: /Contrato completo PDF y Word/ }).waitFor();
      const imported = await snapshot(importedPage); expect(imported.legal_team.runs[0].id).toBe(run.id); expect(imported.tables.documentVersions.find((v: any) => v.original_filename === 'Contrato extenso.txt').sha256).toBe(largeVersion.sha256); await restoredContext.close();
      expect(errors).toEqual([]); expect(external).toEqual([]);
      await writeFile(report + '/browser.json', JSON.stringify({ status: 'PASS', formats: ['PDF', 'DOCX', 'TXT'], normal_files_bytes: [pdf.length, docx.length, txt.length], large_original_bytes: large.length, complete_final_clauses: true, original_pdf_download_exact: true, indexeddb_migration_and_reload: true, portable_backup: true, external_requests: external, browser_errors: errors, paid_calls: 0 }, null, 2));
    } catch (error) { await page.screenshot({ path: report + '/failure.png', fullPage: true }); await writeFile(report + '/failure.txt', await page.locator('body').innerText()); throw error; }
  } finally { await browser?.close(); await new Promise<void>(done => server.close(() => done())); }
}, 120000);
