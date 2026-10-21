import { expect, it } from "vitest";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { handleJunta } from "../../scripts/junta-bridge.mjs";
it("presents legal roles without provider setup tables and rejects legacy paid routes and cross-origin calls", async () => {
  const origin = "http://127.0.0.1:4315",
    root = resolve("dist/web");
  const server = createServer(async (req, res) => {
    if (await handleJunta(req, res, origin)) return;
    try {
      let path = resolve(root, "." + new URL(req.url, origin).pathname);
      if (path !== root && !path.startsWith(root + sep)) throw Error();
      if (!extname(path)) path = resolve(root, "index.html");
      res.setHeader(
        "Content-Type",
        extname(path) === ".js"
          ? "text/javascript"
          : extname(path) === ".css"
            ? "text/css"
            : "text/html",
      );
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'",
      );
      res.end(await readFile(path));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(4315, "127.0.0.1", resolve);
    });
    expect(
      (
        await fetch(origin + "/local/junta/live", {
          method: "POST",
          headers: { Origin: origin },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await fetch(origin + "/local/junta/demo", {
          method: "POST",
          headers: {
            Origin: "https://untrusted.invalid",
            "X-Junta-Offline": "1",
          },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(origin + "/local/junta/demo", {
          method: "POST",
          headers: { Origin: origin, "X-Junta-Offline": "1" },
          body: '{"authorize_paid_calls":true}',
        })
      ).status,
    ).toBe(422);
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const external = [],
      errors = [];
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin)
        return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Trabajo jurídico", exact: true })
      .click();
    await page.getByRole('heading',{name:'Bandeja de producción',exact:true}).waitFor();
    await page.locator('.workflow-guide summary').click();
    await page.getByRole('heading',{name:'Cómo trabaja el Equipo jurídico',exact:true}).waitFor();
    expect(await page.locator('.workflow-guide').innerText()).toContain('abogado humano');
    expect(await page.getByText('JEV_API_KEY',{exact:true}).count()).toBe(0);
    expect(await page.locator('input[type="password"]').count()).toBe(0);
    const visible=await page.locator('main').innerText();
    expect(visible).not.toMatch(/gpt-|gemini-|jev-|API_KEY|SIMULATED_VERIFIED|PASS_IN_SCOPE/);
    expect(await page.getByRole('button',{name:'Ejecutar demo offline',exact:true}).count()).toBe(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await mkdir("junta-local/reports", { recursive: true });
    await page.screenshot({ path: "junta-local/reports/junta-1366.png" });
    await writeFile(
      "junta-local/reports/browser.json",
      JSON.stringify(
        {
          status: "PASS",
          no_study_required: true,
          interface: "LEGAL_PRODUCTION_WITH_COLLAPSED_WORKFLOW_GUIDE",
          inference_called: false,
          external_browser_requests: 0,
          real_route: "NOT_AVAILABLE",
          cross_origin: "DENIED",
          arbitrary_input: "DENIED",
          developer_setup_hidden: true,
          paid_calls: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
