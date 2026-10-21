import { expect, it } from 'vitest';
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';

const snapshot = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('law-order-os.local.v1')!));
function trackedContract() {
  const body = '<w:p><w:r><w:t>Antecedente contractual sintético.</w:t></w:r></w:p>'.repeat(500)
    + '<w:p><w:del><w:r><w:delText>El proveedor deberá entregar en treinta días.</w:delText></w:r></w:del><w:ins><w:r><w:t>El proveedor deberá entregar en sesenta días, si recibe la orden.</w:t></w:r></w:ins></w:p>'
    + '<w:p><w:r><w:t>CLÁUSULA FINAL CONTROLADA: deberá entregar el Anexo Z salvo excepción expresa.</w:t></w:r></w:p>';
  return Buffer.from(zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '</w:body></w:document>'),
  }, { level: 0 }));
}

it('confirms changed team and question beside the uploaded tracked Word, prepares and executes without losing evidence or getting stuck after normalization', async () => {
  const report = 'local-browser/reports/team-preparation'; await mkdir(report, { recursive: true });
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, 'http://127.0.0.1').pathname, file = resolve('dist/web', '.' + (extname(path) ? path : '/index.html'));
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'");
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done)); const address = server.address(); if (!address || typeof address === 'string') throw Error('No port');
    const origin = 'http://127.0.0.1:' + address.port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } }), page = await context.newPage(); page.setDefaultTimeout(15000);
    const external: string[] = [], errors: string[] = [];
    await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin || /^\/(api|local)\//u.test(url.pathname)) { external.push(url.href); return route.abort(); } return route.continue(); });
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin); await page.getByRole('button', { name: 'Administración', exact: true }).click(); await page.getByRole('button', { name: 'Crear estudio', exact: true }).click();
      await page.getByLabel('Nombre del estudio sintético').fill('Estudio de confirmación sintético'); await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      await page.getByRole('button', { name: 'Dashboard', exact: true }).click(); await page.getByLabel('Describí tu encargo sintético').fill('Revisar el contrato sintético y sus condiciones de entrega.'); await page.getByRole('button', { name: /Proponer equipo/ }).click();
      await page.getByRole('button', { name: 'Nuevo cliente aquí', exact: true }).click(); await page.getByLabel('Nombre del cliente nuevo').fill('Cliente sintético de confirmación'); await page.getByLabel('Título del encargo').fill('Contrato con cambios controlados');
      await page.getByLabel('Confirmo que el encargo contiene datos sintéticos.').check(); await page.getByRole('button', { name: 'Confirmar equipo y abrir asunto', exact: true }).click();
      await page.getByLabel('Confirmo datos sintéticos para este encargo local.', { exact: true }).check();
      const original = trackedContract(); expect(original.length).toBeGreaterThan(24576);
      await page.getByLabel('Adjuntar documentos a la consulta').setInputFiles({ name: 'Contrato controlado.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: original });
      await page.getByText('1 documento incorporado al asunto y seleccionado para la consulta.', { exact: false }).waitFor();
      await page.getByLabel('Revisé las observaciones de extracción y sus límites.', { exact: true }).waitFor();
      expect(await page.getByRole('button', { name: 'Preparar consulta', exact: true }).isDisabled()).toBe(true);
      const uploaded = await snapshot(page); expect(uploaded.legal_team.document_extractions[0].status).toBe('REVIEW_REQUIRED');
      await page.getByLabel('Revisé las observaciones de extracción y sus límites.', { exact: true }).check();
      await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).fill('corta');
      await page.getByText('Escribí una pregunta de entre 15 y 2000 caracteres.', { exact: true }).waitFor();
      expect(await page.getByRole('button', { name: 'Confirmar cambios y preparar consulta', exact: true }).isDisabled()).toBe(true);
      const question = 'Revisar las condiciones de entrega del contrato con cambios controlados y el Anexo Z.';
      await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).fill('   ' + question + '   ');
      expect(await page.locator('.team-configuration').count()).toBe(0);
      await page.getByRole('button', { name: 'Modificar equipo', exact: true }).click();
      await page.getByLabel('Profundidad del encargo', { exact: true }).selectOption('DEEP'); await page.getByRole('checkbox', { name: /Incluir a Santiago/ }).check();
      await page.getByLabel('Cuestión de Elena', { exact: true }).fill('  Revisar las obligaciones y excepciones del contrato con su Anexo Z.  ');
      await page.getByRole('button', { name: 'Cerrar edición del equipo', exact: true }).click();
      const prepare = page.getByRole('button', { name: 'Confirmar cambios y preparar consulta', exact: true });
      expect(await prepare.isEnabled()).toBe(true); expect((await snapshot(page)).legal_team.assignments).toHaveLength(1);
      await prepare.scrollIntoViewIfNeeded(); await page.screenshot({ path: report + '/01-confirmar-junto-al-contrato.png' });
      await prepare.click(); await page.getByText('Equipo, cuestiones y evidencia preparados.', { exact: false }).waitFor();
      const prepared = await snapshot(page), assignment = prepared.legal_team.assignments.at(-1), plan = prepared.legal_team.plans.at(-1);
      expect(assignment.version).toBe(2); expect(assignment.config.question).toBe(question); expect(assignment.config.depth).toBe('DEEP'); expect(assignment.config.adversarial).toBe(true);
      expect(plan.assignment_id).toBe(assignment.id); expect(plan.evidence).toHaveLength(1); expect(plan.evidence[0].extraction_status).toBe('REVIEW_REQUIRED'); expect(prepared.legal_team.runs).toHaveLength(0);
      expect(await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).inputValue()).toBe(question);
      expect(await page.locator('.evidence-option input:checked').count()).toBe(1); expect(await page.getByLabel('Revisé las observaciones de extracción y sus límites.', { exact: true }).isChecked()).toBe(true);
      await page.getByRole('button', { name: 'Ejecutar encargo local · USD 0', exact: true }).click(); await page.getByRole('region', { name: 'Documento de trabajo', exact: true }).waitFor();
      const first = (await snapshot(page)).legal_team.runs[0]; expect(first.config.question).toBe(question); expect(first.final_markdown).toContain('CLÁUSULA FINAL CONTROLADA'); expect(first.objections).toHaveLength(1);
      // The original separate confirmation action must also adopt normalized values and leave preparation usable.
      const secondQuestion = 'Revisar nuevamente el contrato sintético y conservar sus condiciones y excepciones.';
      await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).fill('  ' + secondQuestion + '  ');
      await page.getByRole('button', { name: 'Modificar equipo', exact: true }).click(); await page.getByRole('checkbox', { name: /Incluir a Santiago/ }).uncheck();
      await page.getByRole('button', { name: 'Confirmar equipo', exact: true }).click();
      const normalPrepare = page.getByRole('button', { name: 'Preparar consulta', exact: true });
      await expect.poll(() => normalPrepare.isEnabled()).toBe(true);
      expect(await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).inputValue()).toBe(secondQuestion);
      await normalPrepare.click(); await page.getByText('Equipo, cuestiones y evidencia preparados.', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Ejecutar encargo local · USD 0', exact: true }).click(); await expect.poll(async () => (await snapshot(page)).legal_team.runs.length).toBe(2);
      await page.locator('.legal-team-workspace[aria-busy="false"]').waitFor();
      const completed = await snapshot(page), second = completed.legal_team.runs[1];
      expect(second.config.question).toBe(secondQuestion); expect(second.config.adversarial).toBe(false); expect(second.objections).toHaveLength(0); expect(second.final_markdown).toContain('CLÁUSULA FINAL CONTROLADA');
      expect(completed.tables.documents).toHaveLength(1); expect(completed.tables.documentVersions).toHaveLength(1);
      expect(createHash('sha256').update(Buffer.from(completed.tables.documentVersions[0].original_base64, 'base64')).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'));
      await page.screenshot({ path: report + '/02-consulta-ejecutada.png', fullPage: true });
      expect(errors).toEqual([]); expect(external).toEqual([]);
      await writeFile(report + '/browser.json', JSON.stringify({ status: 'PASS', inline_confirmation_and_preparation: true, separate_confirmation_normalized: true, invalid_question_explained: true, tracked_changes_acknowledged: true, selected_document_and_original_preserved: true, explicit_execution: true, completed_runs: 2, external_requests: external, browser_errors: errors, paid_calls: 0 }, null, 2));
    } catch (error) { await page.screenshot({ path: report + '/failure.png', fullPage: true }); await writeFile(report + '/failure.txt', await page.locator('body').innerText()); throw error; }
  } finally { await browser?.close(); await new Promise<void>(done => server.close(() => done())); }
}, 90000);
