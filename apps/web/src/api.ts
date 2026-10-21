import { localMode, localRequest } from "./local-api.js";
export { localMode } from "./local-api.js";
let csrf = "";
const pendingKeys = new Map<string, string>();
export function setCsrf(value: string) {
  csrf = value;
  pendingKeys.clear();
}
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (localMode) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return (await localRequest(path, body)) as T;
  }
  const fingerprint = path + JSON.stringify(body);
  let key = pendingKeys.get(fingerprint);
  if (body !== undefined && !key) {
    key = crypto.randomUUID();
    if (pendingKeys.size > 50) pendingKeys.clear();
    pendingKeys.set(fingerprint, key);
  }
  const response = await fetch("/api/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    signal,
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
            "Idempotency-Key": key!,
          },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        (
          {
            401: "Iniciá sesión para continuar.",
            403: "La acción requiere permiso o la sesión cambió.",
            404: "Recurso no disponible para este usuario.",
            409: "El contenido cambió. Recargá antes de continuar.",
            503: "La dependencia local no está disponible. Revisá PostgreSQL y Supabase.",
          } as Record<number, string>
        )[response.status] ??
          `No se pudo completar la operación (${result.error?.code ?? response.status}).`,
      ),
      { code: result.error?.code },
    );
  pendingKeys.delete(fingerprint);
  return result.data as T;
}
export async function content(path: string): Promise<Blob> {
  if (localMode) return (await localRequest(path)) as Blob;
  const response = await fetch("/api/v1" + path, {
    credentials: "same-origin",
  });
  if (!response.ok) throw Error("No se pudo abrir la versión.");
  return response.blob();
}
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function download(path: string) {
  saveBlob(
    await content(path),
    path.endsWith("/annexes") ? "anexos.zip" : "documento.txt",
  );
}
