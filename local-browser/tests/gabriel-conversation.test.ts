import { it, expect } from "vitest";
import { chromium, expect as browserExpect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";

it("keeps Gabriel's approved identity, model-directed text turns and history across reload", async () => {
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, "http://local").pathname;
      const file = resolve(
        "dist/web",
        "." + (path === "/" ? "/index.html" : path),
      );
      if (
        !file.startsWith(resolve("dist/web") + "/") &&
        !file.startsWith(resolve("dist/web") + "\\")
      )
        throw Error("INVALID_PATH");
      res.setHeader(
        "Content-Type",
        (
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".html": "text/html",
            ".png": "image/png",
          } as Record<string, string>
        )[extname(file)] ?? "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const requests: any[] = [],
    errors: string[] = [];
  let transcripts = 0,
    speech = 0;
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    await context.route("**/local/gabriel/**", async (route) => {
      const operation = new URL(route.request().url()).pathname
        .split("/")
        .at(-1);
      if (operation === "status")
        return route.fulfill({ json: { ready: true } });
      if (operation === "transcribe") {
        transcripts++;
        return route.fulfill({
          json: { text: "¿Y qué hacemos con lo que te conté?" },
        });
      }
      if (operation === "speech") {
        speech++;
        return route.fulfill({ json: { audio: "SUQz", mime: "audio/mpeg" } });
      }
      const body = route.request().postDataJSON();
      requests.push(body);
      return route.fulfill({
        json: {
          reply:
            body.message === "Abrí Clientes"
              ? "Te llevo a Clientes."
              : "Seguimos con la operación que me contaste.",
          action:
            body.message === "Abrí Clientes"
              ? "NAVIGATE"
              : body.message === "Sigamos con eso"
                ? "TEAM"
                : "NONE",
          destination:
            body.message === "Abrí Clientes" ? "clients" : "dashboard",
          analysis_premise:
            body.message === "Sigamos con eso"
              ? "Analizar los riesgos de un contrato de suministro para el proveedor."
              : "",
        },
      });
    });
    await context.addInitScript(() => {
      localStorage.setItem("law-order.gabriel.voice.v1", "false");
      const state = ((window as any).__voiceTest = {
        tracks: [] as any[],
        processors: [] as any[],
        sounds: [] as any[],
        feed: (_seconds: number, _value: number) => {},
      });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const track = {
            stopped: false,
            stop() {
              this.stopped = true;
            },
          };
          state.tracks.push(track);
          return { getTracks: () => [track] };
        },
      });
      (window as any).AudioContext = class {
        sampleRate = 16000;
        destination = {};
        async resume() {}
        async close() {}
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} };
        }
        createGain() {
          return { gain: { value: 1 }, connect() {}, disconnect() {} };
        }
        createScriptProcessor() {
          const processor = {
            onaudioprocess: null,
            connect() {},
            disconnect() {},
          };
          state.processors.push(processor);
          return processor;
        }
      };
      (window as any).Audio = class {
        onended: (() => void) | null = null;
        onerror = null;
        paused = false;
        constructor(_src: string) {
          state.sounds.push(this);
        }
        async play() {}
        pause() {
          this.paused = true;
        }
        removeAttribute() {}
      };
      state.feed = (seconds: number, value: number) =>
        state.processors.at(-1).onaudioprocess?.({
          inputBuffer: {
            getChannelData: () => new Float32Array(16000 * seconds).fill(value),
          },
        });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Administración", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Crear estudio", exact: true })
      .click();
    await page
      .getByLabel("Nombre del estudio sintético")
      .fill("Estudio de prueba de conversación");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    const avatar = page.getByRole("button", {
      name: "Hablar con Gabriel",
      exact: true,
    });
    await avatar.waitFor();
    await browserExpect(avatar.locator("img")).toHaveAttribute(
      "src",
      "/agents/approved-team-reference.png",
    );
    expect(await avatar.locator("canvas").count()).toBe(0);
    const start = (await avatar.boundingBox())!;
    await page.mouse.move(start.x + 45, start.y + 20);
    await page.mouse.down();
    await page.mouse.move(start.x - 100, start.y - 30, { steps: 8 });
    await page.mouse.up();
    expect((await avatar.boundingBox())!.x).toBeLessThan(start.x - 100);
    await avatar.click();
    const panel = page.getByRole("region", {
      name: "Conversación con Gabriel",
    });
    await panel.waitFor();
    await browserExpect(
      panel.getByText("Listo para escucharte", { exact: true }),
    ).toBeVisible();
    const input = page.getByLabel("Mensaje para Gabriel");
    for (const message of [
      "Abrí Clientes",
      "Hablemos de una operación",
      "El cliente quiere vender una parte",
      "Quiere conservar el control",
      "¿Y qué alternativas hay?",
    ]) {
      await input.fill(message);
      await input.press("Enter");
      await browserExpect.poll(() => requests.length).toBeGreaterThan(0);
      await browserExpect(
        panel.getByText("Listo para escucharte", { exact: true }),
      ).toBeVisible();
    }
    expect(requests).toHaveLength(5);
    expect(requests[4].history).toHaveLength(8);
    expect(requests[4].history[0].content).toBe("Abrí Clientes");
    await page.reload();
    await page
      .getByRole("button", { name: "Hablar con Gabriel", exact: true })
      .click();
    await browserExpect(
      page.getByText("¿Y qué alternativas hay?", { exact: true }),
    ).toBeVisible();
    // Native full-duplex voice is covered by gabriel-realtime-browser.test.ts.
    expect(transcripts).toBe(0);
    expect(speech).toBe(0);
    await page.getByLabel("Mensaje para Gabriel").fill("Sigamos con eso");
    await page.getByLabel("Mensaje para Gabriel").press("Enter");
    await browserExpect(
      page.getByRole("dialog", { name: "Prepará el análisis" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Cerrar propuesta de equipo", exact: true })
      .click();
    await mkdir("local-browser/reports/gabriel", { recursive: true });
    await page.screenshot({
      path: "local-browser/reports/gabriel/approved-conversation.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
