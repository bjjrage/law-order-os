import {
  BrowserPersistence,
  STORAGE_KEY,
  LOCAL_PROFILES,
  type Snapshot,
} from "./local-storage.js";
import type { Identity } from "../../../os-core/src/contracts.js";
let enabled = false;
let cached = "";
let cachedRevision = -1;
let user: Identity | null = null;
let directory: Identity[] = [...LOCAL_PROFILES];
let accounts: Identity[] = [];
const memory = {
  getItem: () => cached || null,
  setItem: () => {
    throw Error(
      "El servidor central guarda los cambios; no se admiten escrituras directas del navegador.",
    );
  },
};
const store = new BrowserPersistence(memory);
export const centralEnabled = () => enabled;
export const centralStore = () => store;
export const centralUser = () => user;
export const availableProfiles = () => directory;
export const accountProfiles = () => (enabled ? accounts : directory);
const pending = new Map<string, string>();
export async function platformRequest<T = any>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch("/local/platform/" + path, {
    credentials: "same-origin",
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Platform": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("platform-session-expired"));
    throw Object.assign(
      Error(result.error ?? "No se pudo completar la operación local."),
      { status: response.status, code: result.code ?? result.error },
    );
  }
  return result as T;
}
export function setCentralSession(result: {
  snapshot: Snapshot;
  identity: Identity;
  profiles: Identity[];
}) {
  if (
    user?.id === result.identity.id &&
    result.snapshot.revision < cachedRevision
  )
    return;
  enabled = true;
  cached = JSON.stringify(result.snapshot);
  cachedRevision = result.snapshot.revision;
  user = result.identity;
  accounts = result.profiles;
  directory = [
    ...new Map(
      [
        ...LOCAL_PROFILES,
        ...(result.snapshot.identities ?? []),
        ...result.profiles,
      ].map((p) => [p.id, p]),
    ).values(),
  ];
}
export async function refreshCentral() {
  setCentralSession(await platformRequest("state"));
}
export async function centralRequest(path: string, body?: unknown) {
  const fingerprint = JSON.stringify([path, body]);
  if (body !== undefined && !pending.has(fingerprint))
    pending.set(fingerprint, crypto.randomUUID());
  const result = await platformRequest("core", {
    path,
    body,
    command_id: pending.get(fingerprint),
    known_revision: cachedRevision,
  });
  pending.delete(fingerprint);
  if (result.snapshot) {
    if (result.identity.id !== user?.id)
      throw Error("La sesión cambió. Volvé a abrir el asunto con tu cuenta.");
    setCentralSession(result);
  }
  if (result.blob)
    return new Blob(
      [Uint8Array.from(atob(result.blob.base64), (c) => c.charCodeAt(0))],
      { type: result.blob.type },
    );
  return result.data;
}
export async function signOut() {
  const response = await fetch("/local/auth/sign-out", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw Error("No se pudo cerrar la sesión.");
  cached = "";
  user = null;
  pending.clear();
  location.reload();
}
export async function legacySnapshot() {
  // Reading this storage never overwrites the recovery copy.
  const { BrowserDocumentStorage } =
    await import("./browser-document-storage.js");
  const local = new BrowserDocumentStorage(localStorage);
  await local.ready();
  return local.getItem(STORAGE_KEY);
}
