import { expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import {
  publishWebBuild,
  readWebResponse,
} from "../../scripts/web-release.mjs";

async function fixture(run) {
  const parent = resolve(tmpdir()),
    root = await mkdtemp(resolve(parent, "law-web-release-"));
  try {
    await run(root);
  } finally {
    const target = resolve(root);
    if (target.startsWith(parent + sep) && target !== parent)
      await rm(target, { recursive: true, force: true });
  }
}
const html = (name) =>
  `<!doctype html><head><script type="module" src="/assets/${name}.js"></script></head>`;
async function release(root, name) {
  await mkdir(resolve(root, "assets"), { recursive: true });
  await writeFile(
    resolve(root, "assets", name + ".js"),
    `export const version = "${name}";`,
  );
  await writeFile(resolve(root, "index.html"), html(name));
}
it("publica la nueva entrada y conserva los módulos de una pestaña de la versión anterior", async () =>
  fixture(async (root) => {
    const live = resolve(root, "live"),
      next = resolve(root, "next");
    await release(live, "version-a");
    await writeFile(
      resolve(live, "assets", "panel-a.js"),
      "export default 'Panel anterior';",
    );
    await release(next, "version-b");
    await publishWebBuild(next, live);
    expect(await readFile(resolve(live, "index.html"), "utf8")).toBe(
      html("version-b"),
    );
    const old = await readWebResponse(live, "/assets/panel-a.js");
    expect(old.status).toBe(200);
    expect(old.type).toContain("javascript");
    expect(old.bytes.toString()).toBe("export default 'Panel anterior';");
    expect(old.cache).toContain("immutable");
    expect((await readWebResponse(live, "/assets/version-b.js")).status).toBe(
      200,
    );
  }));
it("un build incompleto o con colisiones no reemplaza la entrada válida", async () =>
  fixture(async (root) => {
    const live = resolve(root, "live"),
      broken = resolve(root, "broken");
    await release(live, "version-a");
    await mkdir(broken);
    await writeFile(resolve(broken, "index.html"), html("missing"));
    await expect(publishWebBuild(broken, live)).rejects.toThrow();
    expect(await readFile(resolve(live, "index.html"), "utf8")).toBe(
      html("version-a"),
    );
    await release(broken, "version-a");
    await writeFile(
      resolve(broken, "assets/version-a.js"),
      "different bytes with the same name",
    );
    await expect(publishWebBuild(broken, live)).rejects.toThrow(
      "WEB_BUILD_ASSET_COLLISION",
    );
    expect(
      await readFile(resolve(live, "assets/version-a.js"), "utf8"),
    ).toContain('"version-a"');
  }));
it("un asset ausente devuelve 404, una ruta de aplicación devuelve HTML sin caché y bloquea escapes", async () =>
  fixture(async (root) => {
    await release(root, "version-a");
    for (const path of [
      "/assets/missing.js",
      "/assets/missing.css",
      "/assets/no-extension",
      "/missing.png",
    ]) {
      const response = await readWebResponse(root, path);
      expect(response.status).toBe(404);
      expect(response.type).not.toContain("html");
    }
    const route = await readWebResponse(root, "/asuntos/abierto", (value) =>
      value.replace("<head>", '<head><meta name="test">'),
    );
    expect(route.status).toBe(200);
    expect(route.cache).toBe("no-store");
    expect(route.bytes.toString()).toContain('name="test"');
    expect((await readWebResponse(root, "/%2e%2e/private.js")).status).toBe(
      403,
    );
    expect((await readWebResponse(root, "/%zz")).status).toBe(400);
  }));
