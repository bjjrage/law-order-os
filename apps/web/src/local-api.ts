import type {
  Authenticator,
  Identity,
} from "../../../os-core/src/contracts.js";
import { BrowserPersistence, LOCAL_PROFILES } from "./local-storage.js";
import { BrowserDocumentStorage } from "./browser-document-storage.js";
import { executeCoreCommand } from "./local-commands.js";
import {
  centralEnabled,
  centralRequest,
  centralStore,
  centralUser,
} from "./platform-client.js";

export const localMode = import.meta.env.VITE_DATA_MODE !== "server";
const PROFILE_KEY = "law-order-os.local.profile";
export function currentProfile(): Identity {
  if (centralEnabled() && centralUser()) return centralUser()!;
  return (
    LOCAL_PROFILES.find((p) => p.id === localStorage.getItem(PROFILE_KEY)) ??
    LOCAL_PROFILES[0]
  );
}
export function selectLocalProfile(id: string) {
  if (centralEnabled())
    throw Error("Cerrá sesión e ingresá con la cuenta correspondiente.");
  if (!LOCAL_PROFILES.some((p) => p.id === id))
    throw Error("Perfil local desconocido.");
  localStorage.setItem(PROFILE_KEY, id);
}
let storage: BrowserPersistence | undefined;
let documentStorage: BrowserDocumentStorage | undefined;
export function browserStore(): BrowserPersistence {
  if (centralEnabled()) return centralStore();
  if (!storage) {
    if (typeof indexedDB !== "undefined")
      documentStorage = new BrowserDocumentStorage(localStorage);
    storage = new BrowserPersistence(documentStorage ?? localStorage);
  }
  return storage;
}
// Workflow profile selection, explicitly NOT authentication. Server mode retains its own real authenticator.
const profiles: Authenticator = {
  authenticate: async (id) => {
    const p = LOCAL_PROFILES.find((p) => p.id === id);
    return p
      ? {
          identity_id: p.id,
          subject: p.subject,
          session_id: "local-profile",
          expires_at: "2999-01-01T00:00:00.000Z",
        }
      : null;
  },
  identity: async (id) => LOCAL_PROFILES.find((p) => p.id === id) ?? null,
};
export async function localRequest(
  path: string,
  body?: unknown,
): Promise<unknown> {
  if (centralEnabled()) return centralRequest(path, body);
  browserStore();
  await documentStorage?.ready();
  return executeCoreCommand(
    browserStore(),
    currentProfile(),
    profiles,
    path,
    body,
  );
}
