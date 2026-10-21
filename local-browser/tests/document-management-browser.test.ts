import { expect, it } from 'vitest';
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const snapshot = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('law-order-os.local.v1')!));

it('explains document origins, deduplicates repeated uploads and examples, removes and restores originals without losing the question or consultation history', async () => {
  const report = 'local-browser/reports/document-management'; await mkdir(report, { recursive: true });
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, 'http://127.0.0.1').pathname, file = resolve('dist/web', '.' + (extname(path) ? path : '/index.html'));
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'"); res.end(await readFile(file));
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
      await page.getByLabel('Nombre del estudio sintético').fill('Estudio documental sintético'); await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      await page.getByRole('button', { name: 'Dashboard', exact: true }).click(); await page.getByLabel('Describí tu encargo sintético').fill('Revisar el contrato sintético y sus obligaciones de entrega.'); await page.getByRole('button', { name: /Proponer equipo/ }).click();
      await page.getByRole('button', { name: 'Nuevo cliente aquí', exact: true }).click(); await page.getByLabel('Nombre del cliente nuevo').fill('Cliente documental sintético'); await page.getByLabel('Título del encargo').fill('Gestión de documentos sintéticos');
      await page.getByLabel('Confirmo que el encargo contiene datos sintéticos.').check(); await page.getByRole('button', { name: 'Confirmar equipo y abrir asunto', exact: true }).click();
      await page.getByLabel('Confirmo datos sintéticos para este encargo local.', { exact: true }).check();
      const original = Buffer.from('CONTRATO DEL CLIENTE SINTÉTICO\nEl proveedor deberá entregar el informe si recibe la orden.\nCLÁUSULA FINAL DEL ARCHIVO DEL CLIENTE: salvo excepción documentada, deberá entregar el Anexo Z.');
      const file = { name: 'Contrato del cliente.txt', mimeType: 'text/plain', buffer: original };
      await page.getByLabel('Adjuntar documentos a la consulta').setInputFiles([file, { ...file, name: 'Copia del mismo contrato.txt' }]);
      await page.getByText('1 documento incorporado al asunto y seleccionado para la consulta.', { exact: true }).waitFor();
      expect((await snapshot(page)).tables.documents).toHaveLength(1); expect((await snapshot(page)).tables.documentVersions).toHaveLength(1);
      const document = page.locator('.evidence-document').filter({ hasText: 'Contrato del cliente.txt' });
      expect(await document.getByText('Archivo adjunto', { exact: true }).count()).toBe(1); await document.getByText('Ver contenido', { exact: true }).click();
      expect(await document.locator('blockquote').innerText()).toContain('CLÁUSULA FINAL DEL ARCHIVO DEL CLIENTE');
      await page.locator('input[aria-label="Adjuntar documentos a la consulta"]:enabled').waitFor({ state: 'attached' });
      await page.getByLabel('Adjuntar documentos a la consulta').setInputFiles(file); await page.getByText('Este archivo ya estaba en el asunto. No se crearon copias.', { exact: true }).waitFor();
      expect((await snapshot(page)).tables.documents).toHaveLength(1); expect(await page.locator('.evidence-option input:checked').count()).toBe(1);
      await document.getByRole('checkbox').uncheck(); expect(await page.locator('.evidence-document').count()).toBe(1); expect(await page.getByRole('button', { name: 'Preparar consulta', exact: true }).isDisabled()).toBe(true); await document.getByRole('checkbox').check();
      const question = 'Elaborar el contrato del cliente sintético, sus condiciones de entrega y el Anexo Z.';
      await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).fill(question);
      await page.getByRole('button', { name: 'Eliminar Contrato del cliente.txt', exact: true }).click();
      await expect.poll(() => page.locator('.evidence-document').count()).toBe(0); await page.getByText('Documentos eliminados · 1', { exact: true }).waitFor();
      expect(await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).inputValue()).toBe(question); expect(await page.locator('.evidence-option input:checked').count()).toBe(0);
      await page.getByLabel('Adjuntar documentos a la consulta').setInputFiles(file); await page.getByText('1 archivo ya está en la papelera.', { exact: false }).waitFor();
      expect((await snapshot(page)).tables.documents).toHaveLength(1); expect(await page.locator('.evidence-document').count()).toBe(0);
      await page.getByText('Documentos eliminados · 1', { exact: true }).click(); await page.getByRole('button', { name: 'Restaurar Contrato del cliente.txt', exact: true }).click();
      await page.getByRole('button', { name: 'Eliminar Contrato del cliente.txt', exact: true }).waitFor(); expect(await page.locator('.evidence-option input:checked').count()).toBe(0); await document.getByRole('checkbox').check();
      await expect.poll(() => page.locator('.upload-notice').count()).toBe(0);
      expect(await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).inputValue()).toBe(question);
      await page.getByText('Probar con documentos de ejemplo', { exact: true }).click(); await page.getByRole('button', { name: 'Cargar ejemplo sintético', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).tables.documents.length).toBe(3); await page.getByText('Ejemplos de prueba · 2', { exact: true }).click();
      expect(await page.getByText('Ejemplo de prueba', { exact: true }).count()).toBe(2);
      await page.getByRole('checkbox', { name: /^Contrato sintético Elena/ }).uncheck(); await page.getByRole('checkbox', { name: /^Anexo A/ }).uncheck();
      await page.getByRole('button', { name: 'Cargar ejemplo sintético', exact: true }).click(); await page.locator('.legal-team-workspace[aria-busy="false"]').waitFor();
      expect((await snapshot(page)).tables.documents).toHaveLength(3);
      await page.getByRole('checkbox', { name: /^Contrato sintético Elena/ }).uncheck(); await page.getByRole('checkbox', { name: /^Anexo A/ }).uncheck();
      await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: report + '/01-documentos-identificados.png', fullPage: true });
      await page.getByRole('button', { name: 'Confirmar cambios y preparar consulta', exact: true }).click(); await page.getByText('Equipo, cuestiones y evidencia preparados.', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Ejecutar encargo local · USD 0', exact: true }).click(); await page.getByRole('region', { name: 'Documento de trabajo', exact: true }).waitFor();
      const completed = await snapshot(page), run = completed.legal_team.runs[0]; expect(run.evidence).toHaveLength(1); expect(run.final_markdown).toContain('CLÁUSULA FINAL DEL ARCHIVO DEL CLIENTE'); expect(run.config.question).toBe(question);
      const editor = page.getByLabel('Contrato para editar', { exact: true });
      expect(await editor.inputValue()).toContain(original.toString('utf8'));
      expect(await page.locator('.internal-team-review').getAttribute('open')).toBeNull();
      expect(await page.locator('body').innerText()).not.toContain('Interpretación documental:');
      const firstDraft = (await editor.inputValue()) + '\n\nCLÁUSULA EDITADA POR EL ABOGADO: pendiente de aprobación.';
      await editor.fill(firstDraft); await page.getByRole('button', { name: 'Guardar documento en Borradores', exact: true }).click();
      await page.getByText('Documento guardado en Borradores.', { exact: false }).waitFor();
      await expect.poll(() => editor.isEnabled()).toBe(true);
      const secondDraft = firstDraft + '\nSEGUNDA VERSIÓN HUMANA: especificaciones a confirmar.';
      await editor.fill(secondDraft); await page.getByRole('button', { name: 'Guardar nueva versión del documento', exact: true }).click();
      await page.getByText('Documento guardado en Borradores.', { exact: false }).waitFor(); await expect.poll(() => editor.inputValue()).toBe(secondDraft);
      const saved = await snapshot(page), savedDraft = saved.tables.drafts[0], savedVersion = saved.tables.documentVersions.find((v: any) => v.id === savedDraft.document_version_id);
      expect(savedDraft.status).toBe('DRAFT'); expect(Buffer.from(savedVersion.original_base64, 'base64').toString('utf8')).toBe(secondDraft);
      const draftDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Descargar documento de trabajo', exact: true }).click();
      expect(await readFile((await (await draftDownload).path())!, 'utf8')).toBe(secondDraft);
      await page.screenshot({ path: report + '/03-documento-de-trabajo.png', fullPage: true });
      await page.getByRole('button', { name: 'Eliminar Contrato del cliente.txt', exact: true }).click(); await page.getByText('Archivo eliminado del asunto.', { exact: false }).waitFor();
      expect((await snapshot(page)).legal_team.runs[0].final_markdown).toBe(run.final_markdown); expect(await page.getByRole('button', { name: 'Ejecutar encargo local · USD 0', exact: true }).isDisabled()).toBe(true);
      await page.reload(); await page.getByRole('button', { name: /Gestión de documentos sintéticos/ }).click(); await page.getByText('Documentos eliminados · 1', { exact: true }).waitFor();
      expect(await page.locator('.evidence-document').filter({ hasText: 'Contrato del cliente.txt' }).count()).toBe(0); expect(await page.getByLabel('Pregunta del equipo jurídico', { exact: true }).inputValue()).toBe(question);
      await page.getByLabel('Confirmo datos sintéticos para este encargo local.', { exact: true }).check(); await page.getByText('Probar con documentos de ejemplo', { exact: true }).click(); await page.getByRole('button', { name: 'Cargar ejemplo sintético', exact: true }).click();
      await page.locator('.legal-team-workspace[aria-busy="false"]').waitFor(); const restored = await snapshot(page); expect(restored.tables.documents).toHaveLength(4); expect(restored.tables.documentVersions).toHaveLength(5); expect(restored.legal_team.runs).toHaveLength(1);
      await expect.poll(() => page.getByLabel('Contrato para editar', { exact: true }).inputValue()).toBe(secondDraft);
      expect(Buffer.from(restored.tables.documentVersions.find((v: any) => v.original_filename === file.name).original_base64, 'base64')).toEqual(original); expect(restored.legal_team.document_changes.map((c: any) => c.action)).toEqual(['REMOVE', 'RESTORE', 'REMOVE']);
      await page.getByText('Documentos eliminados · 1', { exact: true }).click(); await page.screenshot({ path: report + '/02-papelera-e-historial.png', fullPage: true });
      expect(errors).toEqual([]); expect(external).toEqual([]);
      await writeFile(report + '/browser.json', JSON.stringify({ status: 'PASS', origins_and_original_names_visible: true, content_preview: true, repeated_upload_and_batch_deduplicated: true, examples_separate_and_reused_after_reload: true, removal_excludes_from_consultation: true, trash_and_restore: true, repeated_upload_from_trash_does_not_recreate: true, question_preserved: true, historical_run_and_original_unchanged: true, external_requests: external, browser_errors: errors, paid_calls: 0 }, null, 2));
    } catch (error) { await page.screenshot({ path: report + '/failure.png', fullPage: true }); await writeFile(report + '/failure.txt', await page.locator('body').innerText()); throw error; }
  } finally { await browser?.close(); await new Promise<void>(done => server.close(() => done())); }
}, 90000);
