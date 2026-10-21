import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { inspect } from "./junta-setup.mjs";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
let running = false;
export async function handleJunta(req, res, origin) {
  const url = new URL(req.url, origin);
  if (!url.pathname.startsWith("/local/junta/")) return false;
  const send = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  if (
    req.headers.host !== new URL(origin).host ||
    (req.headers.origin && req.headers.origin !== origin)
  ) {
    send(403, { error: "Solo disponible desde el origen local." });
    return true;
  }
  try {
    if(url.pathname==='/local/junta/library/coverage'&&req.method==='GET'){
      const {libraryCoverage}=await import('./library-access.mjs');send(200,libraryCoverage(ROOT));return true;
    }
    if(['/local/junta/library/document','/local/junta/library/original'].includes(url.pathname)&&req.method==='GET'){
      const {libraryDocument,libraryOriginal}=await import('./library-access.mjs');
      const id=url.searchParams.get('id'),offset=Number(url.searchParams.get('offset')??0);
      try{
        if(url.pathname.endsWith('/document'))send(200,await libraryDocument(ROOT,id,offset));
        else{const file=await libraryOriginal(ROOT,id);res.writeHead(200,{'Content-Type':file.type,'Content-Disposition':file.disposition,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox; frame-ancestors 'none'"});res.end(file.bytes);}
      }catch(error){send(error.message?.endsWith('_INVALID')?422:error.message==='LIBRARY_DOCUMENT_NOT_INDEXED'||error.message==='LIBRARY_ORIGINAL_UNAVAILABLE'?404:500,{error:error.message==='LIBRARY_ORIGINAL_UNAVAILABLE'?'El original guardado no está disponible o no coincide con su huella. Podés consultar el texto indexado.':'No se pudo abrir esta publicación local.'});}
      return true;
    }
    if(url.pathname==='/local/junta/library/catalog'&&req.method==='GET'){
      const {queryCatalog}=await import('./library-catalog.mjs');
      const query=url.searchParams.get('q')??'',type=url.searchParams.get('type')??'',year=url.searchParams.get('year')??'',page=Number(url.searchParams.get('page')??1),ids=(url.searchParams.get('ids')??'').split(',').filter(Boolean);
      if(query.length>2000||type.length>100||year&&!/^\d{4}$/.test(year)||!Number.isSafeInteger(page)||page<1||page>100000||ids.length>500){send(422,{error:'Criterios de búsqueda inválidos.'});return true;}
      send(200,queryCatalog(ROOT,{query,type,year,page,ids,indexedOnly:url.searchParams.get('indexed')==='1'}));return true;
    }
    if(url.pathname==='/local/junta/library/progress'&&req.method==='GET'){
      const {libraryJobStatus}=await import('./library-job.mjs');send(200,await libraryJobStatus(ROOT));return true;
    }
    if(url.pathname==='/local/junta/library/search'&&req.method==='GET'){
      const query=url.searchParams.get('q')?.trim()??'';
      const asOf=url.searchParams.get('as_of')??new Date().toISOString().slice(0,10);
      if(query.length<3||query.length>2000||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)){send(422,{error:'Escribí al menos tres caracteres para buscar.'});return true;}
      const {researchCase}=await import('./library-research.mjs');
      send(200,await researchCase(ROOT,query,'','',asOf));return true;
    }
    if (url.pathname.startsWith("/local/junta/case/")) {
      if (req.method === "POST") {
        send(410, { code: "LEGAL_WORKFLOW_UNIFIED", error: "Esta ejecución fue reemplazada. Continuá con Gabriel en el workspace: Ágil, Medio o Profundo, con los mismos controles.", workflow: "legal-unified-v1" });
        return true;
      }
      const { statusCase } = await import("./junta-case.mjs");
      if(req.method==='GET'&&url.pathname==='/local/junta/case/report'){
        const {run}=await statusCase(url.searchParams.get('id'));
        if(!run?.analysis){send(409,{error:'Todavía no hay análisis disponible para este informe.'});return true;}
        const {legalDocumentHtml}=await import('../apps/web/src/junta-presentation.ts');
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"});
        res.end(legalDocumentHtml(run));return true;
      }
      if (req.method === "GET" && url.pathname === "/local/junta/case/status") {
        send(200, await statusCase(url.searchParams.get("id")));
        return true;
      }
      send(404, { error: "Informe anterior no disponible." });
      return true;
    }
    if (url.pathname === "/local/junta/status" && req.method === "GET") {
      send(200, await inspect());
      return true;
    }
    if (url.pathname !== "/local/junta/demo" || req.method !== "POST") {
      send(404, {
        error: "La ejecución real no está habilitada en este servidor.",
      });
      return true;
    }
    if (
      req.headers.origin !== origin ||
      req.headers["x-junta-offline"] !== "1"
    ) {
      send(403, { error: "Solicitud local inválida." });
      return true;
    }
    // No arbitrary questions, command arguments, credentials or file paths enter this demonstration.
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024) break;
    }
    if (size > 0) {
      send(422, {
        error: "La demo usa su expediente sintético fijo; no acepta entradas.",
      });
      return true;
    }
    if (running) {
      send(409, { error: "Ya hay una demo en ejecución." });
      return true;
    }
    try {
      await access(resolve(ROOT, "dist/cli/index.js"));
    } catch {
      send(503, { error: "Compilar primero: npm.cmd run build" });
      return true;
    }
    running = true;
    try {
      const requestId = "browser-demo-" + randomUUID();
      const reportDir = resolve(
        ROOT,
        ".board-data/browser-junta/reports",
        requestId,
      );
      await mkdir(reportDir, { recursive: true });
      // Deliberately exclude API keys and NODE_OPTIONS from the child environment.
      const env = Object.fromEntries(
        [
          "SystemRoot",
          "WINDIR",
          "PATH",
          "TEMP",
          "TMP",
          "USERPROFILE",
          "LOCALAPPDATA",
        ]
          .filter((key) => process.env[key])
          .map((key) => [key, process.env[key]]),
      );
      await execute(
        process.execPath,
        [
          "--import",
          pathToFileURL(resolve(ROOT, "scripts/junta-offline-guard.mjs")).href,
          resolve(ROOT, "dist/cli/index.js"),
          "smoke",
          "--request-id",
          requestId,
          "--data-dir",
          resolve(ROOT, ".board-data/browser-junta"),
          "--report-dir",
          reportDir,
        ],
        {
          cwd: ROOT,
          env,
          windowsHide: true,
          timeout: 120000,
          maxBuffer: 2 * 1024 * 1024,
        },
      );
      const result = JSON.parse(
        await readFile(resolve(reportDir, "smoke-offline.json"), "utf8"),
      );
      if (
        result.mode !== "OFFLINE_SIMULATION" ||
        result.cost?.actual_total_usd !== 0
      )
        throw Error();
      send(200, result);
    } finally {
      running = false;
    }
  } catch (error) {
    if (error.code === "EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED") {
      send(409, {
        error:
          "La consulta está preparada. Falta levantar la restricción de gasto para esta ejecución concreta (máximo USD 0.60).",
        code: error.code,
      });
      return true;
    }
    if (error.name === "ZodError" || /^[A-Z0-9_]+$/.test(error.code ?? "")) {
      send(422, {
        error: "No se pudo completar la operación de Junta.",
        code: error.name === "ZodError" ? "INVALID_INPUT" : error.code,
      });
      return true;
    }
    send(503, {
      error:
        "No se pudo completar la demo o leer la configuración. Revisar la compilación local.",
    });
  }
  return true;
}
