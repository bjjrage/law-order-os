import { SelectionTools, WordStatus } from "./WordSelection.js";
import { WordRibbon as DocumentToolbar } from "./WordRibbon.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { workspaceExtensions } from "../../../packages/workspace/src/extensions.js";
import {
  receiptCovers,
  localNames,
  type WorkspaceAccess,
  type DurableReceipt,
  type LocalProfile,
} from "../../../packages/workspace/src/model.js";
import { workspaceRequest, type WorkspaceCheckpoint } from "./workspace-api.js";
import { readRecovery, writeRecovery } from "./workspace-recovery.js";
import "./workspace.css";
import WorkspaceCall from "./WorkspaceCall.js";
import { centralEnabled, accountProfiles } from "./platform-client.js";

type Connection = { doc: Y.Doc; provider: HocuspocusProvider };
type HistoryRow = {
  version_id: string;
  display_name: string;
  created_at: string;
  state_hash: string;
};
function VersionPreview({ content }: { content: JSONContent }) {
  const editor = useEditor(
    {
      extensions: workspaceExtensions(),
      content,
      editable: false,
      injectCSS: false,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "workspace-page",
          "aria-label": "Contenido de la versión registrada",
          role: "document",
        },
      },
    },
    [content],
  );
  return (
    <div className="workspace-version-preview">
      <SelectionTools editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export { WordRibbon as DocumentToolbar } from "./WordRibbon.js";

function DocumentSurface({
  connection,
  access,
  onEditor,
  documentActions,
}: {
  documentActions: ReactNode;
  connection: Connection;
  access: WorkspaceAccess;
  onEditor: (editor: Editor | null) => void;
}) {
  const editor = useEditor(
    {
      extensions: [
        ...workspaceExtensions(),
        Collaboration.configure({ document: connection.doc }),
        CollaborationCaret.configure({
          provider: connection.provider,
          user: {
            name: access.display_name,
            color:
              access.actor_id === "local-administrator" ? "#245b70" : "#96733a",
          },
        }),
      ],
      editable: !access.read_only,
      immediatelyRender: false,
      injectCSS: false,
      editorProps: {
        attributes: {
          class: "workspace-page",
          "aria-label": "Documento colaborativo",
          role: "textbox",
          "aria-multiline": "true",
          spellcheck: "true",
        },
      },
    },
    [connection, access.read_only],
  );
  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);
  return (
    <>
      <DocumentToolbar
        editor={editor}
        readOnly={access.read_only}
        documentActions={documentActions}
      />
      <div className="workspace-paper">
        <EditorContent editor={editor} />
      </div>
      <WordStatus editor={editor} />
    </>
  );
}

export default function CollaborativeDocument({
  access,
  onCheckpoint,
  onBack,
  onEditor,
  onSaved,
}: {
  access: WorkspaceAccess;
  onCheckpoint?: (checkpoint: WorkspaceCheckpoint) => Promise<void>;
  onBack?: () => void;
  onEditor?: (editor: Editor | null) => void;
  onSaved?: (saved: boolean) => void;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connected, setConnected] = useState(false),
    [synced, setSynced] = useState(false),
    [saved, setSaved] = useState(false);
  const [receipt, setReceipt] = useState<DurableReceipt | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [people, setPeople] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [sharing, setSharing] = useState(false),
    [shareLink, setShareLink] = useState(""),
    [shareReadOnly, setShareReadOnly] = useState(false);
  const [shareTarget, setShareTarget] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [preview, setPreview] = useState<{
    version_id: string;
    rich_json: JSONContent;
  } | null>(null);
  const editor = useRef<Editor | null>(null),
    receiptRef = useRef<DurableReceipt | null>(null),
    savedRef = useRef(false);
  const checkpointCommand = useRef<{ hash: string; id: string } | null>(null);
  const copyNoticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(copyNoticeTimer.current), []);
  const actor = access.actor_id,
    roomId = access.room.id,
    token = access.token;
  const callbacks = useRef({ onEditor, onSaved });
  callbacks.current = { onEditor, onSaved };
  useEffect(() => {
    callbacks.current.onSaved?.(saved && connected);
  }, [saved, connected]);
  const recordEditor = useRef((value: Editor | null) => {
    editor.current = value;
    callbacks.current.onEditor?.(value);
  }).current;

  useEffect(() => {
    let disposed = false,
      active: Connection | undefined,
      persistence = Promise.resolve();
    const doc = new Y.Doc(),
      recoveryKey = roomId + ":" + actor;
    receiptRef.current = null;
    savedRef.current = false;
    setReceipt(null);
    setConnection(null);
    setSaved(false);
    setSynced(false);
    setConnected(false);
    setAccessDenied(false);
    setSaveError("");
    setError("");
    const updateSaved = () => {
      const value = receiptRef.current
        ? receiptCovers(receiptRef.current, doc)
        : false;
      savedRef.current = value;
      if (!disposed) setSaved(value);
    };
    const start = async () => {
      try {
        const recovery = access.read_only
          ? null
          : await readRecovery(recoveryKey);
        if (recovery) Y.applyUpdate(doc, recovery);
      } catch {
        if (!disposed)
          setNotice(
            "La recuperación del navegador no está disponible. El guardado confirmado en servidor sigue activo.",
          );
      }
      if (disposed) {
        doc.destroy();
        return;
      }
      const provider = new HocuspocusProvider({
        url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/local/workspace/socket`,
        name: roomId,
        document: doc,
        token,
        onStatus({ status }) {
          if (!disposed) setConnected(status === "connected");
        },
        onClose({ event }) {
          if (!disposed) setConnected(false);
          if (
            event.code === 4401 ||
            event.code === 4403 ||
            event.reason === "WORKSPACE_ACCESS_DENIED"
          ) {
            if (!disposed) {
              setAccessDenied(true);
              setError(
                "El acceso venció o fue retirado. Volvé a abrir el documento desde el asunto.",
              );
            }
            provider.disconnect();
          }
        },
        onSynced({ state }) {
          if (!disposed) setSynced(state);
          if (state) provider.sendStateless("durable-status");
        },
        onAuthenticationFailed() {
          if (!disposed) {
            setAccessDenied(true);
            setError(
              "El acceso venció o fue retirado. Volvé a abrir el documento desde el asunto.",
            );
          }
          provider.disconnect();
        },
        onStateless({ payload }) {
          try {
            const value = JSON.parse(payload);
            if (
              value.kind === "durable" &&
              value.room_id === roomId &&
              Array.isArray(value.deletions) &&
              typeof value.vector === "string"
            ) {
              if (
                receiptRef.current &&
                value.revision < receiptRef.current.revision
              )
                return;
              receiptRef.current = value;
              if (!disposed) {
                setReceipt(value);
                setSaveError("");
              }
              updateSaved();
            } else if (value.kind === "access_revoked") {
              if (!disposed) {
                setAccessDenied(true);
                setError(
                  "El acceso venció o fue retirado. Volvé a abrir el documento desde el asunto.",
                );
              }
              provider.disconnect();
            } else if (value.kind === "save_error" && !disposed) {
              setSaveError(
                "No se pudo confirmar el guardado. Conservamos la edición en este navegador; reconectá antes de registrar una versión.",
              );
              setSaved(false);
              savedRef.current = false;
            }
          } catch {
            if (!disposed)
              setSaveError("No se pudo comprobar la confirmación de guardado.");
          }
        },
        onAwarenessUpdate({ states }) {
          if (!disposed) {
            const names = [
              ...new Set(
                states
                  .map((state) => state.user?.name)
                  .filter((name): name is string => typeof name === "string"),
              ),
            ].sort();
            setPeople((previous) =>
              previous.join("|") === names.join("|") ? previous : names,
            );
          }
        },
      });
      active = { doc, provider };
      setConnection(active);
      doc.on("update", () => {
        updateSaved();
        const value = Y.encodeStateAsUpdate(doc);
        persistence = persistence
          .catch(() => {})
          .then(() => writeRecovery(recoveryKey, value))
          .catch(() => {
            if (!disposed)
              setNotice(
                "No se pudo conservar la recuperación del navegador. Verificá el estado Guardado antes de cerrar.",
              );
          });
      });
    };
    void start();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!savedRef.current && active && !access.read_only) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      disposed = true;
      window.removeEventListener("beforeunload", beforeUnload);
      active?.provider.destroy();
      if (active) queueMicrotask(() => active?.doc.destroy());
    };
  }, [roomId, token, actor, access.read_only]);

  async function checkpoint() {
    if (
      !connection ||
      !receiptRef.current ||
      !receiptCovers(receiptRef.current, connection.doc)
    )
      return;
    setBusy(true);
    setError("");
    const hash = receiptRef.current.state_hash;
    if (checkpointCommand.current?.hash !== hash)
      checkpointCommand.current = { hash, id: crypto.randomUUID() };
    try {
      const result = await workspaceRequest<WorkspaceCheckpoint>(
        `rooms/${roomId}/checkpoint`,
        token,
        { command_id: checkpointCommand.current.id, state_hash: hash },
      );
      await onCheckpoint?.(result);
      checkpointCommand.current = null;
      setNotice("Versión registrada. La revisión humana queda pendiente.");
      if (history)
        setHistory(
          await workspaceRequest<HistoryRow[]>(
            `rooms/${roomId}/history`,
            token,
          ),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    setBusy(true);
    setError("");
    try {
      const target: LocalProfile = centralEnabled()
        ? shareTarget
        : actor === "local-administrator"
          ? "local-lawyer"
          : "local-administrator";
      const result = await workspaceRequest<WorkspaceAccess>(
        `rooms/${roomId}/share`,
        token,
        { actor_id: target, read_only: shareReadOnly },
      );
      setShareLink(
        `${location.origin}/?workspace=${roomId}#access=${result.token}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const state = accessDenied
    ? "Acceso retirado"
    : saveError
      ? "Guardado sin confirmar"
      : !connected
        ? synced
          ? "Sin conexión · copia local"
          : "Conectando…"
        : !synced
          ? "Sincronizando…"
          : saved
            ? "Guardado en servidor local"
            : "Guardando…";
  const documentActions = (
    <div
      className="workspace-document-actions"
      role="group"
      aria-label="Versiones y acceso al documento"
    >
      {connection && (
        <WorkspaceCall
          provider={connection.provider}
          enabled={connected && synced && !accessDenied}
          name={access.display_name}
        />
      )}
      <button
        disabled={
          busy ||
          !saved ||
          !synced ||
          !connected ||
          access.read_only ||
          !!saveError ||
          accessDenied
        }
        className="workspace-checkpoint-button"
        title={
          "Registrar una versi\u00f3n conserva el historial; no aprueba el documento."
        }
        onClick={() => void checkpoint()}
      >
        Registrar versión
      </button>
      <button
        aria-expanded={history !== null}
        onClick={async () => {
          if (history) {
            setHistory(null);
            return;
          }
          try {
            setHistory(
              await workspaceRequest<HistoryRow[]>(
                `rooms/${roomId}/history`,
                token,
              ),
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Historial
      </button>
      {access.can_manage ? (
        <button aria-expanded={sharing} onClick={() => setSharing(!sharing)}>
          Compartir
        </button>
      ) : null}
      {onBack && (
        <button onClick={onBack} aria-label="Elegir otro documento">
          Volver
        </button>
      )}
    </div>
  );
  return (
    <section
      className="collaborative-workspace"
      aria-label="Workspace del documento"
    >
      {error || saveError ? (
        <p className="workspace-message error" role="alert">
          {accessDenied ? error : saveError || error}
        </p>
      ) : null}
      {notice ? (
        <p className="workspace-message" role="status">
          {notice}
        </p>
      ) : null}
      {sharing ? (
        <section
          className="workspace-share"
          aria-label="Compartir documento local"
        >
          {centralEnabled() ? (
            <label>
              Compartir con
              <select
                value={shareTarget}
                onChange={(e) => {
                  setShareTarget(e.target.value);
                  setShareLink("");
                }}
              >
                <option value="">Seleccioná una persona del estudio</option>
                {accountProfiles()
                  .filter((p) => p.id !== actor)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
              </select>
              <small>Las cuentas se invitan desde Administración.</small>
            </label>
          ) : (
            <strong>
              Colaboración local con{" "}
              {
                localNames[
                  actor === "local-administrator"
                    ? "local-lawyer"
                    : "local-administrator"
                ]
              }
            </strong>
          )}
          <label>
            <input
              type="checkbox"
              checked={shareReadOnly}
              onChange={(event) => setShareReadOnly(event.target.checked)}
            />{" "}
            Enlace de solo lectura
          </label>
          <button
            disabled={busy || (centralEnabled() && !shareTarget)}
            onClick={() => void share()}
          >
            Crear enlace local
          </button>
          {shareLink ? (
            <label className="workspace-share-link">
              {centralEnabled()
                ? "La persona elegida debe ingresar con su cuenta. Para otra computadora, usá la conexión HTTPS del estudio configurada en Administración."
                : "Abrilo en otra pestaña o navegador de esta computadora"}
              <input
                readOnly
                value={shareLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    setNotice("Enlace copiado. Vence en 12 horas.");
                    setSharing(false);
                    clearTimeout(copyNoticeTimer.current);
                    copyNoticeTimer.current = setTimeout(() => {
                      setNotice((current) =>
                        current === "Enlace copiado. Vence en 12 horas."
                          ? ""
                          : current,
                      );
                    }, 3000);
                  } catch {
                    setNotice("Seleccioná el enlace y copialo con Ctrl+C.");
                  }
                }}
              >
                Copiar enlace
              </button>
            </label>
          ) : null}
          <button
            className="danger"
            disabled={busy || (centralEnabled() && !shareTarget)}
            onClick={async () => {
              try {
                await workspaceRequest(`rooms/${roomId}/revoke`, token, {
                  actor_id: centralEnabled()
                    ? shareTarget
                    : actor === "local-administrator"
                      ? "local-lawyer"
                      : "local-administrator",
                });
                setShareLink("");
                setNotice("Acceso del colaborador retirado.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Retirar acceso del colaborador
          </button>
        </section>
      ) : null}
      {history ? (
        <section
          className="workspace-history"
          aria-label="Versiones registradas"
        >
          <strong>Versiones del documento</strong>
          {history.length ? (
            history.map((row) => (
              <div key={row.version_id}>
                <span>
                  {new Date(row.created_at).toLocaleString("es-PY")} ·{" "}
                  {row.display_name}
                </span>
                <button
                  onClick={async () => {
                    try {
                      setPreview(
                        await workspaceRequest(
                          `rooms/${roomId}/versions/${row.version_id}`,
                          token,
                        ),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Ver versión
                </button>
              </div>
            ))
          ) : (
            <p>
              El guardado automático ya conserva el trabajo. Registrá una
              versión para agregar un punto al historial.
            </p>
          )}
          {preview ? (
            <section aria-label="Vista de versión anterior">
              <p>
                Versión registrada · Solo lectura{" "}
                <button onClick={() => setPreview(null)}>Cerrar vista</button>
              </p>
              <VersionPreview content={preview.rich_json} />
            </section>
          ) : null}
        </section>
      ) : null}
      {connection && synced ? (
        <DocumentSurface
          connection={connection}
          access={accessDenied ? { ...access, read_only: true } : access}
          onEditor={recordEditor}
          documentActions={documentActions}
        />
      ) : (
        <p role="status" className="workspace-loading">
          Abriendo documento y recuperación local…
        </p>
      )}
      <footer className="workspace-document-footer">
        <span
          className={
            "workspace-save-state" +
            (saved && connected && !saveError && !accessDenied
              ? " is-saved"
              : "")
          }
          role="status"
          aria-live="polite"
        >
          {state}
        </span>
        <span
          title={
            "Guardado autom\u00e1tico local. Perfiles de prueba sin autenticaci\u00f3n."
          }
        >
          {access.display_name}{" "}
          {access.read_only ? "\u00b7 Solo lectura" : "\u00b7 Edici\u00f3n"}
          {people.length ? " \u00b7 " + people.join(" \u00b7 ") : ""}
        </span>
        {receipt ? (
          <time dateTime={receipt.saved_at}>
            Última confirmación:{" "}
            {new Date(receipt.saved_at).toLocaleTimeString("es-PY")}
          </time>
        ) : null}
      </footer>
    </section>
  );
}
