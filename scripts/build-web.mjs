import { build } from "vite";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { publishWebBuild } from "./web-release.mjs";

const temporaryRoot = resolve(".local-dev/web-builds");
await mkdir(temporaryRoot, { recursive: true });
const staging = await mkdtemp(resolve(temporaryRoot, "release-"));
try {
  await build({
    configFile: resolve("apps/web/vite.config.ts"),
    build: { outDir: staging, emptyOutDir: true },
  });
  await publishWebBuild(staging, resolve("dist/web"));
  console.log(
    "Web publicada: dependencias listas antes del HTML; versiones abiertas conservadas.",
  );
} finally {
  const target = resolve(staging);
  if (target !== temporaryRoot && target.startsWith(temporaryRoot + sep))
    await rm(target, { recursive: true, force: true });
}
