import {
  readWorkspaceOriginal,
  importWorkspaceOriginal,
} from "./workspace-originals.js";
import type { WorkspaceAttachment } from "../../../packages/workspace/src/tasks.js";
import {
  workspaceFileEntries,
  type WorkspaceFileLink,
} from "../../../packages/workspace/src/file-inventory.js";
import { SelectionTools, WordStatus } from "./WordSelection.js";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor, JSONContent } from "@tiptap/core";
import type {
  Draft,
  Matter,
  Document,
} from "../../../os-core/src/contracts.js";
import {
  documentText,
  textDocument,
  type LocalProfile,
  type WorkspaceAccess,
} from "../../../packages/workspace/src/model.js";
import { workspaceExtensions } from "../../../packages/workspace/src/extensions.js";
import { api } from "./api.js";
import { adoptDraft, mergeWorkspaceCheckpoint } from "./workspace-api.js";
import { rememberGabrielDocument } from "./gabriel-workspace.js";
import CollaborativeDocument, {
  DocumentToolbar,
} from "./CollaborativeDocument.js";
import "./workspace.css";
import { WordActions } from "./WordRibbon.js";
import WorkspaceAssistant from "./WorkspaceAssistant.js";
import TeamDocumentUpload from "./TeamDocumentUpload.js";

const PracticePanel = lazy(() => import("./PracticePanel.js"));

function NewDocument({
  initial,
  locked,
  onChange,
  onEditor,
}: {
  onEditor: (editor: Editor | null) => void;
  initial: JSONContent;
  locked: boolean;
  onChange: (rich: JSONContent) => void;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const editor = useEditor({
    extensions: workspaceExtensions(true),
    content: initial,
    injectCSS: false,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => callback.current(current.getJSON()),
    editorProps: {
      attributes: {
        class: "workspace-page",
        role: "textbox",
        "aria-label": "Documento nuevo",
        "aria-multiline": "true",
        spellcheck: "true",
      },
    },
  });
  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);
  useEffect(() => {
    editor?.setEditable(!locked);
  }, [editor, locked]);
  return (
    <>
      <DocumentToolbar editor={editor} readOnly={locked} />
      <div className="workspace-paper workspace-new-paper">
        <SelectionTools editor={editor} />
        <EditorContent editor={editor} />
        {editor?.isEmpty ? (
          <div className="workspace-writing-hint">
            <span>Tu documento empieza acá</span>
            <p>
              Escribí o pegá el texto. Podés darle formato y agregar tablas.
            </p>
          </div>
        ) : null}
      </div>
      <WordStatus editor={editor} />
    </>
  );
}

export default function WorkspacePanel({
  matter,
  drafts,
  actor,
  onChanged,
  onNavigate,
  newDocumentRequest = 0,
  requestedDraftId,
  requestedDraftRevision = 0,
  onGabriel,
}: {
  matter: Matter;
  drafts: Draft[];
  actor: LocalProfile;
  onChanged: () => void;
  onNavigate: (tab: string) => void;
  newDocumentRequest?: number;
  requestedDraftId?: string;
  requestedDraftRevision?: number;
  onGabriel?: () => void;
}) {
  const [selectedOriginals, setSelectedOriginals] = useState<string[] | null>(
    null,
  );
  const [attachments, setAttachments] = useState<WorkspaceAttachment[]>([]),
    [attachmentIssues, setAttachmentIssues] = useState<string[]>([]),
    [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [ribbonHost, setRibbonHost] = useState<HTMLDivElement | null>(null);
  const [reviewHost, setReviewHost] = useState<HTMLDivElement | null>(null);
  const importedCopies = useRef(new Map<string, string>());
  const [importNotice, setImportNotice] = useState<string[]>([]);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [saved, setSaved] = useState(false),
    [filesOpen, setFilesOpen] = useState(false),
    [panel, setPanel] = useState("assistant");
  const [intent, setIntent] = useState<{
    action: "CONSULT" | "ANALYZE" | "REWRITE" | "DRAFT";
    from: number;
    to: number;
    quote: string;
    key: number;
  } | null>(null);

  const [templatesOpen,setTemplatesOpen]=useState(false);
  const editorRef = useRef<Editor | null>(null);
  const recordEditor = useRef((e: Editor | null) => {
    editorRef.current = e;
    setActiveEditor(e);
  }).current;
  function selectIntent(
    action: "CONSULT" | "ANALYZE" | "REWRITE" | "DRAFT",
    target = "assistant",
  ) {
    const e = editorRef.current;
    if (!e) return;
    const selected = e.state.selection;
    const from = selected.empty && action !== "DRAFT" ? 0 : selected.from;
    const to =
      selected.empty && action !== "DRAFT"
        ? e.state.doc.content.size
        : selected.to;
    setIntent({
      action,
      from,
      to,
      quote: e.state.doc.textBetween(from, to, "\n"),
      key: Date.now(),
    });
    setPanel(target);
  }
  function showPanel(value: string) {
    if (value === "junta") setPanel("assistant");
    else if (value === "comments") selectIntent("CONSULT", "comments");
    else setPanel(value);
  }
  const shortcut = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const handle = (e: KeyboardEvent) => shortcut.current(e);
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const recoveryKey = `law-order-os.composer.${matter.id}.${actor}`;
  const lastKey = `law-order-os.last-document.${matter.id}.${actor}`;
  const requestedDraft = useRef(requestedDraftId);
  const requestedRevision = useRef(requestedDraftRevision);
  const [buffer] = useState<{
    title: string;
    rich: JSONContent;
    pending?: { id: string; rich: JSONContent };
  }>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(recoveryKey) ?? "null");
      if (value?.rich?.type === "doc" && typeof value.title === "string")
        return value;
    } catch {
      /* An empty document is still available. */
    }
    return { title: "", rich: textDocument("") };
  });
  const [title, setTitle] = useState(buffer.title),
    [rich, setRich] = useState<JSONContent>(buffer.rich);
  const [access, setAccess] = useState<WorkspaceAccess | null>(null),
    [conflict, setConflict] = useState<WorkspaceAccess | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [recoveryError, setRecoveryError] = useState(""),
    [opening, setOpening] = useState(true),
    [generation, setGeneration] = useState(0);
  const pending = useRef<{ id: string; rich: JSONContent } | null>(
    buffer.pending ?? null,
  );
  const manuallySelected = useRef(newDocumentRequest > 0),
    requestSeen = useRef(newDocumentRequest);
  const path = `/firms/${matter.law_firm_id}/matters/${matter.id}`;
  useEffect(() => {
    try {
      sessionStorage.setItem(
        recoveryKey,
        JSON.stringify({
          title,
          rich,
          ...(pending.current ? { pending: pending.current } : {}),
        }),
      );
    } catch {
      setRecoveryError(
        "La recuperación de esta pestaña no está disponible. Guardá el documento antes de salir.",
      );
    }
  }, [title, rich, recoveryKey]);
  async function open(id: string) {
    setImportNotice([]);
    setIntent(null);
    manuallySelected.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await adoptDraft(
        matter.law_firm_id,
        matter.id,
        id,
        actor,
        pending.current?.id === id ? pending.current.rich : undefined,
      );
      if (result.source_changed) setConflict(result);
      else {
        setAccess(result);
        rememberGabrielDocument(matter.law_firm_id, actor, matter.id, id);
        if (pending.current?.id === id) {
          pending.current = null;
          setRich(textDocument(""));
          setTitle("");
        }
        try {
          localStorage.setItem(lastKey, id);
        } catch {
          /* Preference only. */
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void Promise.all([
      api<Document[]>(path + "/documents"),
      api<Draft[]>(path + "/drafts"),
    ])
      .then(async ([items, saved]) => {
        if (!active) return;
        setDocuments(items);
        let last: string | null = null;
        try {
          last = localStorage.getItem(lastKey);
        } catch {
          /* Preference only. */
        }
        const explicit = saved.find((d) => d.id === requestedDraft.current);
        const selected =
          explicit ?? saved.find((d) => d.id === last) ?? saved[0];
        if (
          selected &&
          (explicit ||
            (!manuallySelected.current &&
              !documentText(buffer.rich).trim() &&
              !buffer.title.trim()))
        )
          await open(selected.id);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setOpening(false);
      });
    return () => {
      active = false;
    };
  }, [path, actor]);
  useEffect(() => {
    if (
      requestedDraftId &&
      (requestedDraftId !== requestedDraft.current ||
        requestedDraftRevision !== requestedRevision.current)
    ) {
      requestedDraft.current = requestedDraftId;
      requestedRevision.current = requestedDraftRevision;
      void open(requestedDraftId);
    }
  }, [requestedDraftId, requestedDraftRevision]);
  useEffect(() => {
    let active = true;
    void api<Document[]>(path + "/documents")
      .then((items) => {
        if (active) setDocuments(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path, drafts]);
  function newDocument() {
    setIntent(null);
    manuallySelected.current = true;
    setAccess(null);
    setConflict(null);
    setError("");
    setGeneration((value) => value + 1);
  }
  useEffect(() => {
    if (requestSeen.current !== newDocumentRequest) {
      requestSeen.current = newDocumentRequest;
      newDocument();
    }
  }, [newDocumentRequest]);
  async function save() {
    if (access) return access;
    setBusy(true);
    setError("");
    manuallySelected.current = true;
    try {
      if (!pending.current) {
        const draft = await api<Draft>(path + "/drafts", {
          title: title.trim() || "Documento de trabajo",
          content: documentText(rich).trim() ? documentText(rich) : "\n",
        });
        pending.current = {
          id: draft.id,
          rich: documentText(rich).trim() ? rich : textDocument("\n"),
        };
        onChanged();
        try {
          sessionStorage.setItem(
            recoveryKey,
            JSON.stringify({ title, rich, pending: pending.current }),
          );
        } catch {
          /* The Core draft is also preserved. */
        }
      }
      const result = await adoptDraft(
        matter.law_firm_id,
        matter.id,
        pending.current.id,
        actor,
        pending.current.rich,
      );
      if (result.source_changed) {
        setConflict(result);
        return;
      }
      setAccess(result);
      pending.current = null;
      setRich(textDocument(""));
      setTitle("");
      try {
        localStorage.setItem(lastKey, result.room.draft_id);
        sessionStorage.removeItem(recoveryKey);
      } catch {
        /* Server save is already confirmed. */
      }
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openOriginal(original: Document) {
    setBusy(true);
    setError("");
    setIntent(null);
    manuallySelected.current = true;
    try {
      if (access && !saved)
        throw Error(
          "El documento abierto todavía se está guardando. Esperá la confirmación antes de abrir otro.",
        );
      if (!access && (documentText(rich).trim() || title.trim())) {
        if (!(await save()))
          throw Error("Guardá el documento actual antes de abrir otro.");
      }
      const key = `law-order-os.original-copy.${matter.id}.${original.current_version_id}`;
      const imported = await importWorkspaceOriginal(path, original);
      let id = importedCopies.current.get(key);
      try {
        id ??= localStorage.getItem(key) ?? undefined;
      } catch {
        /* Preference may be unavailable. */
      }
      if (!id) {
        const draft = await api<Draft>(path + "/drafts", {
          title: original.title,
          content: documentText(imported.rich),
        });
        id = draft.id;
        // Store before adoption so a network retry resumes this copy.
        pending.current = { id, rich: imported.rich };
        importedCopies.current.set(key, id);
        try {
          localStorage.setItem(key, id);
          sessionStorage.setItem(
            recoveryKey,
            JSON.stringify({
              title: original.title,
              rich: imported.rich,
              pending: pending.current,
            }),
          );
        } catch {
          setRecoveryError(
            "La copia quedó creada. La recuperación de esta pestaña no está disponible; esperá la confirmación de guardado antes de salir.",
          );
        }
        onChanged();
      }
      const result = await adoptDraft(
        matter.law_firm_id,
        matter.id,
        id,
        actor,
        pending.current?.id === id ? pending.current.rich : undefined,
      );
      if (result.source_changed) {
        setConflict(result);
        return;
      }
      setAccess(result);
      setSaved(false);
      setImportNotice(imported.notices);
      pending.current = null;
      setRich(textDocument(""));
      setTitle("");
      try {
        localStorage.setItem(lastKey, id);
        sessionStorage.removeItem(recoveryKey);
      } catch {
        /* The server copy is confirmed. */
      }
      // The open working copy is the primary analysis context; annexes are opt-in.
      setSelectedOriginals([]);
      if (access?.room.id !== result.room.id) setPanel("assistant");
    } catch (e) {
      setError((e as Error).message);
      setFilesOpen(true);
    } finally {
      setBusy(false);
    }
  }
  const originals = documents.filter(
    (document) => document.purpose !== "DRAFT",
  );
  const fileLinks: WorkspaceFileLink[] = [];
  for (const original of originals) {
    if (!original.current_version_id) continue;
    const key = `law-order-os.original-copy.${matter.id}.${original.current_version_id}`;
    let draftId = importedCopies.current.get(key);
    try {
      draftId ??= localStorage.getItem(key) ?? undefined;
    } catch {
      /* Optional browser preference. */
    }
    if (draftId)
      fileLinks.push({
        document_id: original.id,
        version_id: original.current_version_id,
        draft_id: draftId,
      });
  }
  const fileEntries = workspaceFileEntries(documents, drafts, fileLinks);
  function selectOriginal(id: string, checked: boolean) {
    setSelectedOriginals(
      checked
        ? [...selectedIds, id]
        : selectedIds.filter((selected) => selected !== id),
    );
  }
  const selectedIds =
    selectedOriginals ?? (originals.length === 1 ? [originals[0]!.id] : []);
  const originalKey = originals
    .map((d) => d.id + ":" + d.current_version_id)
    .join("|");
  const selectedKey = selectedIds.join("|");
  useEffect(() => {
    let active = true;
    setAttachmentsLoading(true);
    setAttachments([]);
    setAttachmentIssues([]);
    void Promise.allSettled(
      originals
        .filter((d) => selectedIds.includes(d.id))
        .map((d) => readWorkspaceOriginal(path, d)),
    ).then((results) => {
      if (!active) return;
      setAttachments(
        results
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<WorkspaceAttachment>).value),
      );
      setAttachmentIssues(
        results
          .filter((r) => r.status === "rejected")
          .map((r) => (r as PromiseRejectedResult).reason.message),
      );
      setAttachmentsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [path, originalKey, selectedKey]);
  shortcut.current = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!access) void save();
      else
        document
          .querySelector<HTMLButtonElement>(".workspace-checkpoint-button")
          ?.click();
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      ["f", "h"].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
      setPanel("search");
    }
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      selectIntent("CONSULT", "comments");
    }
    if (
      event.altKey &&
      event.shiftKey &&
      ["a", "r", "d"].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
      selectIntent(
        event.key.toLowerCase() === "a"
          ? "ANALYZE"
          : event.key.toLowerCase() === "r"
            ? "REWRITE"
            : "DRAFT",
      );
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "e") {
      event.preventDefault();
      selectIntent("CONSULT");
    }
  };
  return (
    <WordActions.Provider
      value={{
        assist: selectIntent,
        open: showPanel,
        print: () => window.print(),
        ribbonHost,
      }}
    >
      <div className="word-workspace">
        <header className="word-appbar">
          <button onClick={() => onNavigate("documents")}>
            ← Volver al asunto
          </button>
          <span className="word-brand">
            L<span>WORKSPACE</span>
          </span>
          <strong
            title={
              access ? matter.title + " / " + access.room.title : matter.title
            }
          >
            {matter.title}
            {access ? " / " + access.room.title : ""}
          </strong>
          {!access && (
            <div className="word-top-document">
              <label>
                <span>DOCUMENTO DE TRABAJO</span>
                <input
                  aria-label="Nuevo documento"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Documento sin título"
                  maxLength={240}
                  disabled={busy || !!pending.current}
                />
              </label>
              <button
                className="primary"
                disabled={busy || (!title.trim() && !documentText(rich).trim())}
                onClick={() => void save()}
              >
                {busy
                  ? "Guardando…"
                  : pending.current
                    ? "Reintentar guardado"
                    : "Guardar documento"}
              </button>
            </div>
          )}
          <div className="word-appbar-actions">
            <button disabled={busy} onClick={async () => {
              if (!access && (title.trim() || documentText(rich).trim()) && !(await save())) return;
              onNavigate("practice");
            }}>Sesiones y portal</button>
            {onGabriel && (
              <button
                onClick={onGabriel}
                title="Conversar con Gabriel sin salir del documento"
              >
                Gabriel · voz
              </button>
            )}
            <button
              aria-pressed={filesOpen}
              aria-expanded={filesOpen}
              onClick={() => setFilesOpen((v) => !v)}
            >
              Archivos
            </button>
            <button
              aria-pressed={panel === "findings"}
              onClick={() => showPanel(panel === "findings" ? "" : "findings")}
            >
              Revisar documento
            </button>
            <button
              aria-pressed={!!panel && !["findings", "draft"].includes(panel)}
              onClick={() =>
                setPanel((v) =>
                  v && !["findings", "draft"].includes(v) ? "" : "assistant",
                )
              }
            >
              ✦ Equipo y comentarios
            </button>
          </div>
        </header>
        <section
          className={
            "workspace-studio workspace-has-ribbon" +
            (filesOpen ? " files-open" : "") +
            (panel && !["findings", "draft"].includes(panel)
              ? " assistant-open"
              : "")
          }
          aria-label="Workspace del asunto"
        >
          <div className="word-ribbon-host" ref={setRibbonHost} />
          <aside
            className="workspace-files"
            hidden={!filesOpen}
            aria-label="Documentos de trabajo"
          >
            <div className="workspace-files-heading">
              <span>ARCHIVOS DEL ASUNTO</span>
              <span>{fileEntries.length}</span>
              <button
                aria-label="Plegar archivos"
                onClick={() => setFilesOpen(false)}
              >
                ‹
              </button>
            </div>
            <button
              className="workspace-create"
              onClick={newDocument}
              disabled={busy}
            >
              ＋ Nuevo documento
            </button>
            <button className="workspace-create" disabled={busy} onClick={()=>{void(async()=>{if(!access&&documentText(rich).trim()&&!await save())return;setTemplatesOpen(true)})()}}>Usar modelo del estudio</button>
            <div
              className="workspace-file-list workspace-unified-files"
              aria-label="Inventario de archivos"
            >
              {fileEntries.map((entry) => (
                <article
                  key={entry.id}
                  className={
                    "workspace-file-entry" +
                    (entry.draft && entry.draft.id === access?.room.draft_id
                      ? " is-current"
                      : "")
                  }
                >
                  <div
                    className={
                      entry.draft
                        ? "workspace-draft-choice"
                        : "word-original-choice"
                    }
                  >
                    {!entry.draft && entry.original && (
                      <input
                        type="checkbox"
                        aria-label={`Incluir como anexo: ${entry.original.title}`}
                        checked={selectedIds.includes(entry.original.id)}
                        onChange={(e) =>
                          selectOriginal(entry.original!.id, e.target.checked)
                        }
                      />
                    )}
                    <button
                      className="workspace-open-file"
                      aria-label={`Abrir ${entry.title}`}
                      aria-current={
                        entry.draft && entry.draft.id === access?.room.draft_id
                          ? "page"
                          : undefined
                      }
                      disabled={busy}
                      onClick={() =>
                        entry.draft
                          ? void open(entry.draft.id)
                          : void openOriginal(entry.original!)
                      }
                    >
                      <strong>{entry.title}</strong>
                      <small>
                        {entry.draft && entry.draft.id === access?.room.draft_id
                          ? "Abierto · editable"
                          : entry.draft
                            ? "Documento editable"
                            : "Abrir una copia editable ↗"}
                      </small>
                    </button>
                  </div>
                  {entry.draft && entry.original && (
                    <details className="workspace-file-provenance">
                      <summary>Original conservado</summary>
                      <p>{entry.original.title}</p>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`Usar original como anexo: ${entry.original.title}`}
                          checked={selectedIds.includes(entry.original.id)}
                          onChange={(e) =>
                            selectOriginal(entry.original!.id, e.target.checked)
                          }
                        />
                        Incluir en la consulta como anexo
                      </label>
                      <small>
                        La consulta ya incluye el documento abierto. El original
                        se conserva sin cambios.
                      </small>
                    </details>
                  )}
                </article>
              ))}
              {!fileEntries.length && (
                <p className="workspace-file-empty">
                  Subí un archivo o creá un documento para empezar.
                </p>
              )}
            </div>
            <TeamDocumentUpload
              base={path}
              disabled={busy}
              consent
              onBusy={setBusy}
              compact
              onIncorporated={async (items, ids) => {
                setSelectedOriginals(ids);
                setDocuments(items);
                onChanged();
                const original = items.find((d) => d.id === ids[0]);
                if (original) await openOriginal(original);
              }}
            />
          </aside>
          <div
            className={
              "workspace-document-stage" +
              (["findings", "draft"].includes(panel) ? " review-open" : "")
            }
          >
            <div className="workspace-editing-area">
              {importNotice.length > 0 && (
                <details className="workspace-import-notice">
                  <summary>
                    Copia editable abierta · original conservado
                  </summary>
                  {importNotice.map((n, i) => (
                    <p key={i}>{n}</p>
                  ))}
                </details>
              )}
              {error || recoveryError ? (
                <p className="workspace-message error" role="alert">
                  {error || recoveryError}
                </p>
              ) : null}
              {conflict ? (
                <div className="workspace-message" role="alert">
                  <strong>Hay dos versiones conservadas.</strong>
                  <p>
                    El borrador anterior sigue guardado. Podés abrir la versión
                    compartida para revisarla.
                  </p>
                  <button
                    onClick={() => {
                      setAccess(conflict);
                      setConflict(null);
                    }}
                  >
                    Abrir documento compartido
                  </button>
                  <button onClick={() => setConflict(null)}>Volver</button>
                </div>
              ) : null}
              {opening &&
              drafts.length > 0 &&
              !newDocumentRequest &&
              !buffer.title.trim() &&
              !documentText(buffer.rich).trim() ? (
                <p className="workspace-loading" role="status">
                  Abriendo tu último documento…
                </p>
              ) : access ? (
                <CollaborativeDocument
                  key={access.room.id + actor}
                  access={access}
                  onEditor={recordEditor}
                  onSaved={setSaved}
                  onCheckpoint={async (result) => {
                    const merged = await mergeWorkspaceCheckpoint(
                      result,
                      access.browser_version_id ??
                        access.room.checkpoint_version_id,
                    );
                    if (merged)
                      setAccess((current) =>
                        current
                          ? {
                              ...current,
                              browser_version_id: result.version.id,
                              room: {
                                ...current.room,
                                checkpoint_version_id: result.version.id,
                              },
                            }
                          : null,
                      );
                    onChanged();
                    if (!merged)
                      throw Error(
                        "La versión está guardada en el workspace. Se conservó también una edición distinta de Borradores; no la reemplazamos automáticamente.",
                      );
                  }}
                />
              ) : (
                <section
                  className="workspace-composer"
                  aria-label="Nuevo documento de trabajo"
                >
                  <NewDocument
                    key={generation}
                    initial={rich}
                    locked={busy || !!pending.current}
                    onChange={setRich}
                    onEditor={recordEditor}
                  />
                  <footer className="workspace-document-footer">
                    El primer guardado crea el documento en este asunto y
                    conserva el formato. Después, los cambios se guardan
                    automáticamente.
                  </footer>
                </section>
              )}
            </div>
            <div
              className="workspace-review-host"
              ref={setReviewHost}
              hidden={!["findings", "draft"].includes(panel)}
            />
          </div>
          <WorkspaceAssistant
            matterId={matter.id}
            actorId={actor}
            reviewHost={reviewHost}
            attachments={attachments}
            attachmentIssues={attachmentIssues}
            attachmentsLoading={attachmentsLoading}
            editor={activeEditor}
            access={access}
            ensureAccess={save}
            saved={saved}
            panel={panel}
            intent={intent}
            onPanel={showPanel}
            onClose={() => setPanel("")}
          />
        </section>
        {templatesOpen&&<div className="word-overlay"><section role="dialog" aria-modal="true" aria-label="Modelos del estudio"><header><strong>Modelos aprobados · {matter.title}</strong><button onClick={()=>setTemplatesOpen(false)}>Volver al documento ×</button></header><p>Documentos base reutilizables del estudio. Su uso es opcional.</p><Suspense fallback={<p role="status">Cargando modelos…</p>}><PracticePanel templatesOnly firm={matter.law_firm_id} matter={matter} onChanged={onChanged} onOpenDraft={id=>{setTemplatesOpen(false);void open(id)}}/></Suspense></section></div>}

      </div>
    </WordActions.Provider>
  );
}
