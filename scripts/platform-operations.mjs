import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  lstat,
  readdir,
  realpath,
  rename,
  statfs,
} from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { randomUUID, X509Certificate } from "node:crypto";
import { networkInterfaces, hostname } from "node:os";
import { spawn } from "node:child_process";
import { verifyPlatformBackup } from "./platform-backup.mjs";
export const privateIPv4 = (ip) =>
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) &&
  ip.split(".").length === 4 &&
  ip.split(".").every((n) => /^\d{1,3}$/.test(n) && Number(n) <= 255);
export const networkAddresses = () => [
  ...new Set(
    Object.values(networkInterfaces())
      .flat()
      .filter(
        (n) => n?.family === "IPv4" && !n.internal && privateIPv4(n.address),
      )
      .map((n) => n.address),
  ),
];
const configPath = (root) => resolve(root, ".local-dev/network.json");
export async function operationsConfig(root) {
  return {
    version: 1,
    enabled: false,
    bind: null,
    port: 4314,
    external_backup: null,
    ...(await readFile(configPath(root), "utf8")
      .then(JSON.parse)
      .catch((e) => {
        if (e.code !== "ENOENT") throw e;
        return {};
      })),
  };
}
export async function saveOperations(root, patch) {
  const old = await operationsConfig(root),
    next = { ...old, ...patch };
  await mkdir(resolve(root, ".local-dev"), { recursive: true });
  await writeFile(configPath(root), JSON.stringify(next, null, 2), {
    mode: 0o600,
  });
  return next;
}
export async function validateExternalDestination(root, input) {
  if (
    typeof input !== "string" ||
    !isAbsolute(input) ||
    input.length > 500 ||
    input.startsWith("\\\\")
  )
    throw Error("EXTERNAL_BACKUP_LOCAL_ABSOLUTE_PATH_REQUIRED");
  const target = await realpath(input),
    base = await realpath(root),
    rel = relative(base, target);
  if (!rel || (!rel.startsWith("..") && !isAbsolute(rel)))
    throw Error("EXTERNAL_BACKUP_MUST_BE_OUTSIDE_PROJECT");
  if (!(await lstat(target)).isDirectory())
    throw Error("EXTERNAL_BACKUP_DIRECTORY_REQUIRED");
  return target;
}
export async function copyExternalBackup(root, id) {
  if (!/^platform-[a-zA-Z0-9-]+$/.test(id)) throw Error("INVALID_BACKUP_ID");
  const config = await operationsConfig(root);
  if (!config.external_backup) throw Error("EXTERNAL_BACKUP_NOT_CONFIGURED");
  const targetRoot = await validateExternalDestination(
      root,
      config.external_backup,
    ),
    source = resolve(root, ".local-dev/backups", id),
    manifest = await verifyPlatformBackup(source),
    dest = resolve(targetRoot, "LAW_ORDER_BACKUPS", id);
  for (const part of [targetRoot, resolve(targetRoot, "LAW_ORDER_BACKUPS")]) {
    const s = await lstat(part).catch((e) =>
      e.code === "ENOENT" ? null : Promise.reject(e),
    );
    if (s?.isSymbolicLink()) throw Error("BACKUP_SYMLINK_REJECTED");
  }
  if (await lstat(dest).catch(() => null)) {
    await verifyPlatformBackup(dest);
    return { id, status: "VERIFIED_EXISTING" };
  }
  const space = await statfs(targetRoot);
  if (space.bavail * space.bsize < manifest.verified_bytes * 1.05)
    throw Error("EXTERNAL_BACKUP_INSUFFICIENT_DISK_SPACE");
  // A failed transfer never occupies the final backup name. Keep incomplete
  // attempts separately so a retry can create a complete, verified copy.
  const staging = resolve(
    targetRoot,
    "LAW_ORDER_BACKUPS",
    id + ".partial-" + randomUUID(),
  );
  await mkdir(staging, { recursive: true });
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < manifest.files.length) {
        const f = manifest.files[cursor++],
          target = resolve(staging, f.path);
        await mkdir(resolve(target, ".."), { recursive: true });
        await copyFile(resolve(source, f.path), target);
      }
    }),
  );
  await copyFile(
    resolve(source, "manifest.json"),
    resolve(staging, "manifest.json"),
  );
  await verifyPlatformBackup(staging);
  await rename(staging, dest);
  const result = {
    id,
    status: "VERIFIED",
    copied_at: new Date().toISOString(),
  };
  await writeFile(
    resolve(source, "external-copy.json"),
    JSON.stringify(result),
  );
  return result;
}
async function openssl(root, args) {
  const paths =
    process.platform === "win32"
      ? ["C:/Program Files/Git/usr/bin/openssl.exe"]
      : ["/usr/bin/openssl", "/usr/local/bin/openssl"];
  let exe;
  for (const p of paths)
    if (await lstat(p).catch(() => null)) {
      exe = p;
      break;
    }
  if (!exe) throw Error("OPENSSL_REQUIRED_FOR_LOCAL_TLS");
  await new Promise((ok, fail) => {
    const child = spawn(exe, args, {
      cwd: root,
      windowsHide: true,
      shell: false,
      stdio: "ignore",
    });
    child.once("error", fail);
    child.once("exit", (c) =>
      c === 0 ? ok() : fail(Error("TLS_CERTIFICATE_GENERATION_FAILED")),
    );
  });
}
export async function prepareLocalTls(root, bind) {
  if (!networkAddresses().includes(bind) && bind !== "127.0.0.1")
    throw Error("LOCAL_PRIVATE_INTERFACE_REQUIRED");
  const dir = resolve(root, ".local-dev/tls");
  await mkdir(dir, { recursive: true });
  const ca = resolve(dir, "study-ca.crt"),
    caKey = resolve(dir, "study-ca.key");
  if (!(await lstat(ca).catch(() => null)))
    await openssl(root, [
      "req",
      "-x509",
      "-newkey",
      "rsa:3072",
      "-nodes",
      "-keyout",
      caKey,
      "-out",
      ca,
      "-days",
      "3650",
      "-sha256",
      "-subj",
      "/CN=LAW ORDER Local Study CA",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    ]);
  const key = resolve(dir, "server.key"),
    csr = resolve(dir, "server.csr"),
    cert = resolve(dir, "server.crt"),
    ext = resolve(dir, "server.ext");
  await writeFile(
    ext,
    `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,DNS:${hostname().replace(/[^A-Za-z0-9.-]/g, "")},IP:127.0.0.1${bind !== "127.0.0.1" ? ",IP:" + bind : ""}\n`,
  );
  await openssl(root, [
    "req",
    "-new",
    "-newkey",
    "rsa:3072",
    "-nodes",
    "-keyout",
    key,
    "-out",
    csr,
    "-subj",
    "/CN=LAW ORDER Local Server",
  ]);
  await openssl(root, [
    "x509",
    "-req",
    "-in",
    csr,
    "-CA",
    ca,
    "-CAkey",
    caKey,
    "-set_serial",
    "0x" + randomUUID().replaceAll("-", ""),
    "-out",
    cert,
    "-days",
    "365",
    "-sha256",
    "-extfile",
    ext,
  ]);
  return {
    cert: await readFile(cert),
    key: await readFile(key),
    ca: await readFile(ca),
  };
}
export async function operationsStatus(root) {
  const config = await operationsConfig(root),
    ca = await readFile(resolve(root, ".local-dev/tls/study-ca.crt")).catch(
      () => null,
    );
  return {
    ...config,
    addresses: networkAddresses(),
    origin: config.enabled ? `https://${config.bind}:${config.port}` : null,
    ca_fingerprint: ca ? new X509Certificate(ca).fingerprint256 : null,
  };
}
