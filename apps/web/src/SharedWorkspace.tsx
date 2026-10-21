import type { Editor } from "@tiptap/core";
import WorkspaceAssistant from "./WorkspaceAssistant.js";
import { WordActions } from "./WordRibbon.js";
import { useEffect, useState } from "react";
import type { WorkspaceAccess } from "../../../packages/workspace/src/model.js";
import { workspaceRequest } from "./workspace-api.js";
import CollaborativeDocument from "./CollaborativeDocument.js";
import "./workspace.css";

export default function SharedWorkspace() {
  const [editor, setEditor] = useState<Editor | null>(null),
    [saved, setSaved] = useState(false),
    [panel, setPanel] = useState("assistant");
  const [reviewHost, setReviewHost] = useState<HTMLDivElement | null>(null);
  const [ribbonHost, setRibbonHost] = useState<HTMLDivElement | null>(null);
  const [intent, setIntent] = useState<{
    action: "CONSULT" | "ANALYZE" | "REWRITE" | "DRAFT";
    from: number;
    to: number;
    quote: string;
    key: number;
  } | null>(null);
  function assist(
    action: "CONSULT" | "ANALYZE" | "REWRITE" | "DRAFT",
    target = "assistant",
  ) {
    if (!editor) return;
    const selection = editor.state.selection,
      from = selection.empty && action !== "DRAFT" ? 0 : selection.from,
      to =
        selection.empty && action !== "DRAFT"
          ? editor.state.doc.content.size
          : selection.to;
    setIntent({
      action,
      from,
      to,
      quote: editor.state.doc.textBetween(from, to, "\n"),
      key: Date.now(),
    });
    setPanel(target);
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey,
        key = e.key.toLowerCase();
      if (ctrl && ["f", "h"].includes(key)) {
        e.preventDefault();
        setPanel("search");
      }
      if (ctrl && key === "s") {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>(".workspace-checkpoint-button")
          ?.click();
      }
      if (ctrl && e.altKey && key === "m") {
        e.preventDefault();
        assist("CONSULT", "comments");
      }
      if (ctrl && e.shiftKey && key === "e") {
        e.preventDefault();
        assist("CONSULT");
      }
      if (e.altKey && e.shiftKey && ["a", "r", "d"].includes(key)) {
        e.preventDefault();
        assist(key === "a" ? "ANALYZE" : key === "r" ? "REWRITE" : "DRAFT");
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [editor]);
  const [access, setAccess] = useState<WorkspaceAccess | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const room = new URLSearchParams(location.search).get("workspace") ?? "";
    const fragment = new URLSearchParams(location.hash.slice(1)).get("access");
    const key = "law-order-os.workspace-access." + room;
    if (fragment) {
      sessionStorage.setItem(key, fragment);
      history.replaceState(null, "", location.pathname + location.search);
    }
    const token = fragment ?? sessionStorage.getItem(key);
    if (!token) {
      setError(
        "Este enlace no tiene acceso al documento. Pedí un nuevo enlace desde Compartir.",
      );
      return;
    }
    void workspaceRequest<WorkspaceAccess>("rooms/" + room, token)
      .then((result) => {
        if (active) setAccess(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <WordActions.Provider
      value={{
        assist,
        open: (value) =>
          value === "comments" ? assist("CONSULT", value) : setPanel(value),
        print: () => window.print(),
        ribbonHost,
      }}
    >
      <main className="word-workspace workspace-shared">
        <nav className="word-appbar">
          <a href="/">LAW & ORDER OS</a>
          <button
            aria-pressed={!!panel && !["findings", "draft"].includes(panel)}
            onClick={() =>
              setPanel((v) =>
                v && !["findings", "draft"].includes(v) ? "" : "assistant",
              )
            }
          >
            Equipo y comentarios
          </button>
          <button
            aria-pressed={panel === "findings"}
            onClick={() => setPanel(panel === "findings" ? "" : "findings")}
          >
            Revisar documento
          </button>
          <span title={access?.room.title}>
            {access?.room.title ?? "Documento compartido"} {"\u00b7"} Entorno
            local
          </span>
        </nav>
        {error ? (
          <p role="alert" className="workspace-message error">
            {error}
          </p>
        ) : access ? (
          <section
            className={
              "workspace-studio workspace-has-ribbon" +
              (panel && !["findings", "draft"].includes(panel)
                ? " assistant-open"
                : "")
            }
          >
            <div className="word-ribbon-host" ref={setRibbonHost} />
            <div
              className={
                "workspace-document-stage" +
                (["findings", "draft"].includes(panel) ? " review-open" : "")
              }
            >
              <div className="workspace-editing-area">
                <CollaborativeDocument
                  access={access}
                  onEditor={setEditor}
                  onSaved={setSaved}
                />
              </div>
              <div
                className="workspace-review-host"
                ref={setReviewHost}
                hidden={!["findings", "draft"].includes(panel)}
              />
            </div>
            <WorkspaceAssistant
              matterId={access.room.matter_id}
              actorId={access.actor_id}
              reviewHost={reviewHost}
              editor={editor}
              access={access}
              ensureAccess={async () => access}
              saved={saved}
              panel={panel}
              intent={intent}
              onPanel={(value) =>
                value === "comments"
                  ? assist("CONSULT", value)
                  : setPanel(value)
              }
              onClose={() => setPanel("")}
            />
          </section>
        ) : (
          <p role="status">Abriendo documento compartido…</p>
        )}
      </main>
    </WordActions.Provider>
  );
}
