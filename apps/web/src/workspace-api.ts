import { api } from "./api.js";
import { centralEnabled, refreshCentral } from "./platform-client.js";
import type { JSONContent } from "@tiptap/core";
import { browserStore } from "./local-api.js";
import { sha256, decodeBase64 } from "../../../os-core/src/bytes.js";
import type {
  Document,
  DocumentVersion,
  Draft,
} from "../../../os-core/src/contracts.js";
import {
  WorkspaceSeedSchema,
  type LocalProfile,
  type WorkspaceAccess,
} from "../../../packages/workspace/src/model.js";

const messages: Record<string, string> = {
  WORKSPACE_HISTORY_NOT_FOUND:
    "Ese trabajo no está guardado en este documento. Revisá el inventario de trabajos del asunto.",
  WORKSPACE_INTEGRATION_NOT_RESUMABLE:
    "Esta ejecución no se puede continuar automáticamente. Los aportes guardados siguen disponibles para revisar.",
  WORKSPACE_INTEGRATION_ALREADY_RESUMED:
    "La continuación ya está registrada. Revisá su progreso en la conversación; no se volvió a ejecutar.",
  WORKSPACE_ACCESS_DENIED:
    "El acceso al documento venció o fue retirado. Abrilo nuevamente desde el asunto.",
  WORKSPACE_VERSION_CONFLICT:
    "Otra persona cambió el documento. Esperá a que se guarde y volvé a registrar la versión.",
  WORKSPACE_SOURCE_CONFLICT:
    "Hay una versión distinta guardada en el servidor. Se conservaron ambas; abrí el documento compartido para revisarlas.",
  WORKSPACE_DATABASE_UNAVAILABLE:
    "No se pudo iniciar el guardado local. Revisá el servidor del OS y volvé a intentar.",
  WORKSPACE_SIZE_LIMIT:
    "Este documento supera el tamaño admitido para la edición colaborativa local.",
  WORKSPACE_TEAM_CONFIRMATION_REQUIRED:
    "Contale el pedido a Gabriel para que elija los especialistas necesarios.",
  WORKSPACE_ANALYSIS_LEVEL_INVALID:
    "Elegí Ágil, Medio o Profundo antes de enviar el pedido.",
  WORKSPACE_PLAN_STALE:
    "Cambió el documento o el contexto. Presentá el caso de nuevo para actualizar el equipo antes de analizar.",
  WORKSPACE_PLAN_ALREADY_EXECUTED:
    "Ese equipo ya tiene una ejecución registrada. Revisá su resultado en la conversación; no se volvió a ejecutar.",
  WORKSPACE_CONTEXT_LIMIT:
    "El documento y sus anexos superan la capacidad de esta consulta. Seleccioná un fragmento o quitá anexos para continuar.",
};
export async function workspaceRequest<T>(
  path: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch("/local/workspace/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Workspace": "1" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(
        messages[result.error] ??
          "No se pudo completar la operación. El trabajo confirmado sigue guardado en el servidor local.",
      ),
      { status: response.status, code: result.error },
    );
  return result as T;
}
export async function adoptDraft(
  firm: string,
  matter: string,
  draftId: string,
  actor: LocalProfile,
  initialRich?: JSONContent,
) {
  // api() ensures large browser snapshots are hydrated before reading the existing Core records.
  await api(`/firms/${firm}/matters/${matter}/drafts`);
  const state = browserStore().snapshot();
  const f = state.tables.lawFirms.find((r) => r.id === firm),
    m = state.tables.matters.find((r) => r.id === matter);
  const draft = state.tables.drafts.find(
    (r) => r.id === draftId && r.matter_id === matter && r.law_firm_id === firm,
  );
  if (!f || !m || !draft)
    throw Error("No se encontró el borrador en este asunto.");
  const client = state.tables.clients.find((r) => r.id === m.client_id);
  const document = state.tables.documents.find(
    (r) => r.id === draft.document_id,
  );
  const version = state.tables.documentVersions.find(
    (r) => r.id === draft.document_version_id,
  );
  const seed = WorkspaceSeedSchema.parse({
    actor_id: actor,
    synthetic_data: !centralEnabled(),
    ...(initialRich ? { initial_rich: initialRich } : {}),
    firm: f,
    client,
    matter: m,
    draft,
    document,
    version,
    memberships: state.tables.memberships.filter((r) => r.law_firm_id === firm),
    participants: state.tables.participants.filter(
      (r) => r.law_firm_id === firm && r.matter_id === matter,
    ),
  });
  return workspaceRequest<WorkspaceAccess>("adopt", undefined, seed);
}
export interface WorkspaceCheckpoint {
  document: Document;
  draft: Draft;
  version: DocumentVersion;
  rich_hash: string;
  human_review: "PENDING";
}
/** Copies a named server checkpoint into the same browser Core, without overwriting a concurrent legacy edit. */
export async function mergeWorkspaceCheckpoint(
  result: WorkspaceCheckpoint,
  baseVersion: string,
) {
  if (centralEnabled()) {
    await refreshCentral();
    return true;
  }
  if (
    (await sha256(decodeBase64(result.version.original_base64))) !==
    result.version.sha256
  )
    throw Error("La versión recibida no pasó el control de integridad.");
  return browserStore().transaction(async (tx) => {
    const draft = await tx.get("drafts", result.draft.id);
    if (!draft) return false; // A collaborator using a share link need not import another browser's complete OS.
    if (
      draft.document_version_id !== baseVersion &&
      draft.document_version_id !== result.version.id
    )
      return false;
    if (!(await tx.get("documentVersions", result.version.id)))
      await tx.insert("documentVersions", result.version);
    await tx.replace("documents", result.document);
    await tx.replace("drafts", result.draft);
    for (const review of await tx.list("reviews", {
      law_firm_id: draft.law_firm_id,
      matter_id: draft.matter_id,
    })) {
      if (review.draft_id !== draft.id || review.status !== "PENDING") continue;
      await tx.replace("reviews", { ...review, status: "SUPERSEDED" });
      for (const task of await tx.list("tasks", {
        law_firm_id: draft.law_firm_id,
        matter_id: draft.matter_id,
      }))
        if (task.draft_review_id === review.id)
          await tx.replace("tasks", { ...task, status: "CANCELLED" });
    }
    return true;
  });
}
