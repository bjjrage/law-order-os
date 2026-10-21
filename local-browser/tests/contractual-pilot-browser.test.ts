import { expect, it } from 'vitest';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

it('walks the synthetic Elena workflow in a real browser, persists after reload and rechecks an edited draft without network inference', async () => {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url!, 'http://127.0.0.1').pathname;
      const file = resolve('dist/web', '.' + (extname(pathname) ? pathname : '/index.html'));
      const mime: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html', '.svg': 'image/svg+xml' };
      res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw Error('No port');
    const origin = 'http://127.0.0.1:' + address.port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
    const unexpected: string[] = [], errors: string[] = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/local/')) { unexpected.push(url.href); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    expect(await page.locator('.specialist-studio').count()).toBe(0);
    await page.getByRole('button', { name: 'Administración', exact: true }).click();
    await page.getByRole('button', { name: 'Crear estudio', exact: true }).click();
    await page.getByLabel('Nombre del estudio sintético').fill('Estudio Elena sintético');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('button', { name: 'Clientes', exact: true }).click();
    await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Cliente Elena sintético');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('heading', { name: 'Cliente Elena sintético', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Nuevo asunto', exact: true }).click();
    await page.getByLabel('Título', { exact: true }).fill('Contrato sintético de Elena');
    await page.locator('select[name="subject_area"]').selectOption('Contratos');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('heading', { name: 'Contrato sintético de Elena', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Equipo jurídico', exact: true }).click();
    await page.locator('.legal-team-workspace, .archived-pilot').waitFor();
    if (await page.getByText('Historial y herramientas anteriores', { exact: true }).count()) {
      await page.getByText('Historial y herramientas anteriores', { exact: true }).click();
      await page.getByRole('button', { name: 'Abrir piloto contractual anterior', exact: true }).click();
    }
    await page.getByRole('heading', { name: 'Elena · Contratos y obligaciones', exact: true }).waitFor();
    expect(await page.getByRole('button', { name: 'Ejecutar piloto offline · USD 0', exact: true }).isDisabled()).toBe(true);
    await page.getByLabel('Confirmo datos sintéticos para el piloto offline.', { exact: true }).check();
    await page.getByRole('button', { name: 'Confirmar a Elena como titular', exact: true }).click();
    await page.getByText('Elena, confirmada', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Cargar contrato sintético de ejemplo', exact: true }).click();
    await page.getByLabel('Contrato sintético Elena · Original', { exact: true }).check();
    await page.getByLabel('Anexo A · Original', { exact: true }).check();
    await page.getByLabel('Confirmo datos sintéticos para el piloto offline.', { exact: true }).check();
    await page.getByRole('button', { name: 'Preparar consulta offline', exact: true }).click();
    await page.getByText('Equipo y evidencia preparados.', { exact: false }).waitFor();
    const preparedOnly = await page.evaluate(() => JSON.parse(localStorage.getItem('law-order-os.local.v1')!).specialist_pilot);
    expect(preparedOnly.assignments).toHaveLength(1); expect(preparedOnly.runs).toHaveLength(0);
    await page.getByRole('button', { name: 'Ejecutar piloto offline · USD 0', exact: true }).click();
    await page.getByRole('article', { name: 'Informe contractual offline', exact: true }).waitFor();
    const report = await page.getByRole('article').innerText();
    expect(report).toContain('SIMULACIÓN OFFLINE'); expect(report).toContain('Anexo B');
    expect(report).toContain('Hay importes diferentes'); expect(report).toContain('Salvo demora');
    expect(report).not.toMatch(/gpt-|Gemini|OpenAI|model_id|\bLuna\b|\bSol\b/);
    expect(await page.locator('body').innerText()).not.toMatch(/gpt-|Gemini|OpenAI|model_id|\bLuna\b|\bSol\b/);
    await mkdir('local-browser/reports/elena-pilot', { recursive: true });
    await page.screenshot({ path: 'local-browser/reports/elena-pilot/1366.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: 'local-browser/reports/elena-pilot/1440.png', fullPage: true });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar informe contractual', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('elena-revision-contractual-sintetica.md');
    const downloadedPath = await download.path();
    const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('law-order-os.local.v1')!));
    expect(await readFile(downloadedPath!, 'utf8')).toBe(snapshot.specialist_pilot.runs[0].final_markdown);
    await page.reload();
    await page.getByRole('button', { name: 'Clientes', exact: true }).click();
    await page.getByRole('button', { name: 'Cliente Elena sintético', exact: true }).click();
    await page.getByRole('button', { name: 'Contrato sintético de Elena', exact: true }).click();
    await page.getByRole('button', { name: 'Equipo jurídico', exact: true }).click();
    await page.locator('.legal-team-workspace, .archived-pilot').waitFor();
    if (await page.getByText('Historial y herramientas anteriores', { exact: true }).count()) {
      await page.getByText('Historial y herramientas anteriores', { exact: true }).click();
      await page.getByRole('button', { name: 'Abrir piloto contractual anterior', exact: true }).click();
    }
    await page.getByRole('article', { name: 'Informe contractual offline', exact: true }).waitFor();
    await page.getByLabel('Confirmo datos sintéticos para el piloto offline.', { exact: true }).check();
    await page.getByRole('button', { name: 'Guardar borrador contractual', exact: true }).click();
    await page.getByRole('button', { name: 'Borrador guardado', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Borradores', exact: true }).click();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByRole('heading', { name: 'Nueva versión del borrador', exact: true }).waitFor().catch(async error => {
      await page.screenshot({ path: 'local-browser/reports/elena-pilot/edit-failure.png', fullPage: true });
      console.log('EDIT_DIAGNOSTIC', await page.getByRole('alert').allTextContents(), await page.locator('body').innerText());
      throw error;
    });
    const content = page.getByLabel('Contenido de la versión', { exact: true });
    await content.fill(await content.inputValue() + '\nSentencia N° 999999 | tribunal: Tribunal Sintético | 2024-01-15');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('button', { name: 'Equipo jurídico', exact: true }).click();
    await page.locator('.legal-team-workspace, .archived-pilot').waitFor();
    if (await page.getByText('Historial y herramientas anteriores', { exact: true }).count()) {
      await page.getByText('Historial y herramientas anteriores', { exact: true }).click();
      await page.getByRole('button', { name: 'Abrir piloto contractual anterior', exact: true }).click();
    }
    await page.getByText('El borrador cambió:', { exact: false }).waitFor();
    await page.getByLabel('Confirmo datos sintéticos para el piloto offline.', { exact: true }).check();
    await page.getByRole('button', { name: 'Comprobar fuentes de la nueva versión', exact: true }).click();
    await page.getByText('Control ligado a la versión guardada.', { exact: false }).waitFor();
    const final = await page.evaluate(() => JSON.parse(localStorage.getItem('law-order-os.local.v1')!));
    expect(final.specialist_pilot.draft_links).toHaveLength(2);
    expect(final.specialist_pilot.draft_links[1].audit.status).toBe('REVIEW_REQUIRED');
    expect(final.tables.drafts[0].status).toBe('DRAFT'); expect(final.specialist_pilot.runs).toHaveLength(1);
    expect(unexpected).toEqual([]); expect(errors).toEqual([]);
    await writeFile('local-browser/reports/elena-pilot/browser.json', JSON.stringify({ status: 'PASS', mode: 'OFFLINE_SIMULATION', workflow: ['assign', 'prepare', 'execute', 'export_exact_text', 'reload', 'save_draft', 'edit_draft', 'recheck_exact_version'], external_requests: 0, model_requests: 0, paid_calls: 0, deployments: 0, horizontal_overflow: false, screenshots: ['1366.png', '1440.png'], legal_skill_evaluation: 'NOT_RUN' }, null, 2));
  } finally { await browser?.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});



