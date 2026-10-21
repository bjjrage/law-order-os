import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  rename,
  stat,
} from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { randomUUID } from "node:crypto";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

async function atomicFile(target, bytes) {
  await mkdir(dirname(target), { recursive: true });
  const temporary = target + "." + randomUUID() + ".tmp";
  await writeFile(temporary, bytes);
  await rename(temporary, target);
}

/** Publish dependencies before switching the entry point. Never remove old hashed assets. */
export async function publishWebBuild(staging, destination) {
  staging = resolve(staging);
  destination = resolve(destination);
  const entry = await readFile(resolve(staging, "index.html"));
  const references = [
    ...entry
      .toString("utf8")
      .matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g),
  ];
  if (!references.length) throw Error("WEB_BUILD_ENTRY_ASSETS_MISSING");
  for (const [, reference] of references) {
    const dependency = resolve(staging, "." + reference.split(/[?#]/)[0]);
    if (
      !dependency.startsWith(resolve(staging, "assets") + sep) ||
      !(await stat(dependency)).isFile()
    )
      throw Error("WEB_BUILD_INVALID_ASSET");
  }
  async function copy(folder, relative = "") {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const name = relative ? relative + "/" + item.name : item.name;
      if (name === "index.html") continue;
      if (item.isSymbolicLink()) throw Error("WEB_BUILD_SYMLINK_REJECTED");
      if (item.isDirectory()) await copy(resolve(folder, item.name), name);
      else if (item.isFile()) {
        const bytes = await readFile(resolve(folder, item.name));
        const target = resolve(destination, name);
        if (name.startsWith("assets/")) {
          // Existing content-addressed files stay untouched for open sessions.
          const existing = await readFile(target).catch((e) => {
            if (e.code === "ENOENT") return null;
            throw e;
          });
          if (existing?.equals(bytes)) continue;
          if (existing) throw Error("WEB_BUILD_ASSET_COLLISION");
        }
        await atomicFile(target, bytes);
      }
    }
  }
  await copy(staging);
  await atomicFile(resolve(destination, "index.html"), entry);
}

/** HTML fallback is only for application routes, never missing JavaScript/CSS. */
export async function readWebResponse(
  root,
  pathname,
  transformHtml = (value) => value,
) {
  root = resolve(root);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return failure(400);
  }
  if (decoded.includes("\0")) return failure(400);
  const requested = resolve(root, "." + decoded);
  if (requested !== root && !requested.startsWith(root + sep))
    return failure(403);
  let file = requested;
  try {
    if (!(await stat(file)).isFile())
      throw Object.assign(Error(), { code: "ENOENT" });
  } catch (e) {
    if (e.code !== "ENOENT" && e.code !== "ENOTDIR") throw e;
    if (decoded.startsWith("/assets/") || extname(decoded)) return failure(404);
    file = resolve(root, "index.html");
  }
  let bytes;
  try {
    bytes = await readFile(file);
  } catch (e) {
    if (e.code === "ENOENT") return failure(404);
    throw e;
  }
  const extension = extname(file);
  if (extension === ".html")
    bytes = Buffer.from(transformHtml(bytes.toString("utf8")));
  return {
    status: 200,
    bytes,
    type: mime[extension] ?? "application/octet-stream",
    cache: file.startsWith(resolve(root, "assets") + sep)
      ? "public, max-age=31536000, immutable"
      : "no-store",
  };
}
function failure(status) {
  return {
    status,
    bytes: Buffer.from("Archivo no disponible."),
    type: "text/plain; charset=utf-8",
    cache: "no-store",
  };
}
