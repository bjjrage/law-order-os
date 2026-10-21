import { expect, it } from "vitest";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {handleJunta} from '../../scripts/junta-bridge.mjs';
it("works without API, login or database, preserves readable workspace layout and reloads local data", async () => {
  const server = createServer(async (req, res) => {
    if(await handleJunta(req,res,'http://127.0.0.1:4314'))return;
    try {
      const file = resolve(
        "dist/web",
        "." + new URL(req.url!, "http://127.0.0.1:4314").pathname,
      );
      const path = extname(file) ? file : resolve("dist/web/index.html");
      res.setHeader(
        "Content-Type",
        extname(path) === ".js"
          ? "text/javascript"
          : extname(path) === ".css"
            ? "text/css"
            : "text/html",
      );
      res.end(await readFile(path));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(4314, "127.0.0.1", resolve);
    });
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: 'reduce',
    });
    const requests: string[] = [],
      failures: string[] = [];
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      requests.push(url.href);
      return url.origin === "http://127.0.0.1:4314" &&
        !url.pathname.startsWith("/api/")
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => failures.push(e.message));
    await page.goto("http://127.0.0.1:4314");
    await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
    expect(await page.getByLabel("Contraseña", { exact: true }).count()).toBe(
      0,
    );
    await page.getByRole('button', {name:'Administración',exact:true}).click();
    await page
      .getByRole("button", { name: "Crear estudio", exact: true })
      .click();
    await page
      .getByLabel("Nombre del estudio sintético")
      .fill("Estudio local sintético");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("button", { name: "Clientes", exact: true }).click();
    expect(await page.getByRole('button',{name:'Crear estudio',exact:true}).count()).toBe(0);
    expect(await page.getByRole('button',{name:'Nuevo asunto',exact:true}).count()).toBe(0);
    await page
      .getByRole("button", { name: "Nuevo cliente", exact: true })
      .click();
    await page
      .getByLabel("Nombre", { exact: true })
      .fill("Cliente local sintético");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByText("Cliente local sintético", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Clientes", exact: true }).click();
    await page.getByText("Cliente local sintético", { exact: true }).waitFor();
    const measurements = await page.evaluate(() => ({
      font: getComputedStyle(document.body).fontSize,
      topbar: document.querySelector(".topbar")!.getBoundingClientRect().height,
      sidebar: document.querySelector(".sidebar")!.getBoundingClientRect()
        .width,
    }));
    expect(measurements).toEqual({ font: "12px", topbar: 44, sidebar: 170 });
    await page.getByRole('button',{name:'Cliente local sintético',exact:true}).click();
    await page.getByRole('heading',{name:'Cliente local sintético',exact:true}).waitFor();
    await page.getByRole('button',{name:'Nuevo asunto',exact:true}).click();
    const selectedClient=await page.locator('select[name="client_id"] option:checked').textContent();
    expect(selectedClient).toBe('Cliente local sintético');
    await page.getByLabel('Título',{exact:true}).fill('Contrato de prueba vertical');
    await page.locator('select[name="subject_area"]').selectOption('Contratos');
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await page.getByRole('heading',{name:'Contrato de prueba vertical',exact:true}).waitFor();
    expect(await page.getByRole('tab',{name:'Documentos',exact:true}).getAttribute('aria-selected')).toBe('true');
    await page.getByRole('button',{name:'Incorporar original',exact:true}).waitFor();
    await page.getByRole('button',{name:'Equipo jurídico',exact:true}).click();
    await page.getByText('Historial y herramientas anteriores', { exact: true }).click();
    await page.getByRole('button', { name: 'Abrir piloto contractual anterior', exact: true }).click();
    await page.getByRole('heading',{name:'Elena · Contratos y obligaciones',exact:true}).waitFor();
    await page.getByText('Consultas anteriores del asunto',{exact:true}).click();
    await page.getByRole('button',{name:'Abrir consulta anterior',exact:true}).click();
    await page.getByRole('heading',{name:'Una pregunta concreta. Un análisis en contexto.',exact:true}).waitFor();
    await page.getByLabel('Cargar documento para consultar (.txt)',{exact:true}).setInputFiles({name:'Contrato ficticio.txt',mimeType:'text/plain',buffer:await readFile('local-browser/demo/MOCK_JUNTA_CONTRATO.txt')});
    await page.locator('.matter-workbench').getByRole('checkbox',{name:/^Contrato ficticio/}).waitFor();
    await page.getByLabel('Pregunta jurídica concreta',{exact:true}).fill('¿Qué documentación falta para revisar la rescisión del contrato de servicios?');
    await page.getByLabel('Confirmo que esta prueba contiene únicamente datos sintéticos y no confidenciales.',{exact:true}).check();
    // Real browser → local preparation → real indexed official PDFs. No provider execution.
    await page.getByRole('button',{name:'Buscar fuentes · sin gasto de IA',exact:true}).click();
    await page.getByRole('heading',{name:'Fuentes de la consulta',exact:true}).waitFor();
    const bibliography=page.locator('.junta-sources');
    await bibliography.locator('.research-source').filter({hasText:'Jurisprudencia'}).first().locator('summary').click();
    expect(await bibliography.innerText()).toContain('Página');
    const publicSourceUrl = new URL((await bibliography.getByRole('link',{name:'Abrir publicación oficial ↗',exact:true}).first().getAttribute('href'))!);
    expect(publicSourceUrl.protocol).toBe('https:');
    expect(['pj.gov.py','csj.gov.py','digestolegislativo.gov.py'].some(host=>publicSourceUrl.hostname===host||publicSourceUrl.hostname.endsWith('.'+host))).toBe(true);
    expect(requests.some(url=>/\/case\/(consult|run)$/.test(url))).toBe(false);
    await mkdir('junta-local/reports',{recursive:true});
    await page.screenshot({path:'junta-local/reports/library-real-retrieval-preview.png',fullPage:true});
    await page.getByLabel('Pregunta jurídica concreta',{exact:true}).fill('¿Qué documentación falta para revisar este contrato ficticio y sus avisos?');
    let preparedRequests=0,consultRequests=0;
    const preparedId='550e8400-e29b-41d4-a716-446655440000';
    const stageNames=['ROUTING_EVIDENCE','BUILDING_CONTEXT','PRINCIPAL_ANALYSIS','ADVERSARIAL_AUDIT','CHECKING_REFERENCES'];
    const stages=stageNames.map(stage=>({stage,model_id:'TEST_ONLY',status:'PASS',error_code:null,latency_ms:1000,estimated_cost_usd:0}));
    const startedAt=new Date(Date.now()-118093).toISOString();
    let finishConsult!:()=>void;
    const finish=new Promise<void>(resolve=>{finishConsult=resolve;});
    await page.route('**/local/junta/case/status?*',async route=>route.fulfill({json:{prepared_id:preparedId,run:{run_id:'test-only-run',mode:'SIMULATED',question:'Consulta de prueba',status:'PRINCIPAL_ANALYSIS',error_code:null,analysis:null,audit:null,stages:[...stages.slice(0,2),{...stages[2],status:'STARTED'}],cost:{estimated_total_usd:null,actual_total_usd:null},timing:{started_at:startedAt,finished_at:null,elapsed_ms:118093,stage_time_ms:2000,source:'LOCAL_PERSISTENCE_TIMESTAMPS'}}}}));
    await page.route('**/local/junta/case/prepare',async route=>{preparedRequests++;const b=route.request().postDataJSON();expect(b.documents).toHaveLength(1);expect(b.question).toContain('contrato ficticio');await route.fulfill({json:{prepared_id:preparedId,prepared_hash:'test',question:b.question,documents:b.documents.map((d:{id:string;version_id:string})=>({document_id:d.id,version_id:d.version_id})),budget_usd:0.6}});});
    await page.route('**/local/junta/case/consult',async route=>{consultRequests++;expect(route.request().postDataJSON()).toEqual({prepared_id:preparedId,owner_approval:true,max_cost_usd:0.6,synthetic_data:true});await finish;await route.fulfill({json:{run_id:'test-only-run',question:'Consulta de prueba',mode:'SIMULATED',status:'HUMAN_REVIEW_PENDING',error_code:null,analysis:{legal_analysis:'RESPUESTA SIMULADA EXCLUSIVA DEL TEST: faltan anexos.\n\n1. Documentación: Solicitar el contrato completo.\n\nNo se acredita incumplimiento.',limitations:['Solo prueba.'],unresolved_issues:[]},audit:null,stages,reference_verification:'TEST_ONLY',cost:{estimated_total_usd:0.050737152,actual_total_usd:null,latency_ms:114276},timing:{started_at:startedAt,finished_at:new Date().toISOString(),elapsed_ms:118093,stage_time_ms:114276,source:'LOCAL_PERSISTENCE_TIMESTAMPS'}}});});
    await page.getByRole('button',{name:'Consultar Junta · hasta USD 0,60',exact:true}).click();
    await page.getByRole('heading',{name:'Deliberación en curso',exact:true}).waitFor();
    await expect.poll(()=>page.getByRole('progressbar',{name:'Etapas completadas'}).getAttribute('value')).toBe('2');
    await mkdir('junta-local/reports',{recursive:true});
    await page.screenshot({path:'junta-local/reports/progress-test-simulation.png'});
    finishConsult();
    await page.getByText('RESPUESTA SIMULADA EXCLUSIVA DEL TEST: faltan anexos.',{exact:true}).waitFor();
    await page.getByRole('heading',{name:'Deliberación finalizada',exact:true}).waitFor();
    await page.screenshot({path:'junta-local/reports/document-test-simulation.png'});
    expect(await page.getByRole('progressbar',{name:'Etapas completadas'}).getAttribute('value')).toBe('5');
    await page.getByRole('heading',{name:'01 Documentación',exact:true}).waitFor();
    await page.getByRole('button',{name:/^Verificador de citas/}).click();
    const publicProgress=await page.getByRole('region',{name:'Progreso de deliberación'}).innerText();
    expect(publicProgress).not.toMatch(/TEST_ONLY|gpt-|gemini-|jev-|PASS|HUMAN_REVIEW_PENDING/);
    expect(await page.getByRole('button',{name:'Descargar resultado',exact:true}).count()).toBe(0);
    const lawyerDocument=await page.getByRole('article').innerText();
    expect(lawyerDocument).toContain('Afirmaciones, documentos y citas');
    expect(lawyerDocument).not.toMatch(/PASS_IN_SCOPE|UNKNOWN|DOCUMENT_CONTENT|snapshot|checker/);
    const reportDownload=page.waitForEvent('download');
    await page.getByRole('button',{name:'Descargar informe jurídico',exact:true}).click();
    expect((await reportDownload).suggestedFilename()).toBe('informe-juridico-junta.html');
    expect(preparedRequests).toBe(1);expect(consultRequests).toBe(1);
    expect(await page.getByRole('button',{name:'Consultar Junta · hasta USD 0,60',exact:true}).isDisabled()).toBe(true);
    expect(await page.getByRole('button',{name:'Preparar consulta sin gastar',exact:true}).count()).toBe(0);
    expect(await page.getByRole('button',{name:'Crear estudio',exact:true}).count()).toBe(0);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar respaldo", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe(
      "law-order-respaldo.json",
    );
    const backup = await page.evaluate(() =>
      localStorage.getItem("law-order-os.local.v1")!,
    );
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    page.once("dialog", (d) => d.accept());
    await page
      .getByLabel("Importar respaldo", { exact: true })
      .setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(backup),
      });
    await page.getByRole("button", { name: "Clientes", exact: true }).click();
    await page.getByText("Cliente local sintético", { exact: true }).waitFor();
    await mkdir("local-browser/reports", { recursive: true });
    await page.screenshot({ path: "local-browser/reports/local-1366.png" });
    expect(failures).toEqual([]);
    expect(
      requests.some(
        (url) =>
          new URL(url).pathname.startsWith("/api/") ||
          new URL(url).hostname !== "127.0.0.1",
      ),
    ).toBe(false);
    await writeFile(
      "local-browser/reports/browser.json",
      JSON.stringify(
        {
          status: "PASS",
          authentication: "NONE_LOCAL_PROFILES_ONLY",
          persistence: "BROWSER_LOCALSTORAGE",
          backup_roundtrip: true,
          measurements,
          api_requests: 0,
          external_requests: 0,
          paid_calls: 0,
          deployments: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
