import { useEditorState, type Editor } from "@tiptap/react";
import { useContext, useState } from "react";
import { WordActions } from "./WordRibbon.js";
export function SelectionTools({ editor }: { editor: Editor | null }) {
  const actions = useContext(WordActions);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      from: e?.state.selection.from,
      to: e?.state.selection.to,
      editable: e?.isEditable,
    }),
  });
  if (!editor || !state?.editable || state.from === state.to) return null;
  return (
    <div
      className="word-selection-tools"
      role="toolbar"
      aria-label="Trabajar sobre la selección"
      onMouseDown={(e) => e.preventDefault()}
    >
      <span>Texto seleccionado</span>
      <button onClick={() => actions?.assist("ANALYZE")}>✦ Analizar</button>
      <button onClick={() => actions?.assist("REWRITE")}>Reformular</button>
      <button onClick={() => actions?.open("comments")}>Comentar</button>
    </div>
  );
}
export function WordStatus({ editor }: { editor: Editor | null }) {
  const [zoom, setZoom] = useState(100);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return (
        localStorage.getItem("law-order-os.zoom-status-collapsed.v1") !==
        "false"
      );
    } catch {
      return true;
    }
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      text: e?.state.doc.textContent ?? "",
      selected: e?.state.selection.empty
        ? 0
        : (e?.state.selection.to ?? 0) - (e?.state.selection.from ?? 0),
    }),
  });
  return (
    <div className={"word-status" + (collapsed ? " is-collapsed" : "")}>
      <div className="word-status-controls" hidden={collapsed}>
        <span>
          {state?.text.trim().split(/\s+/).filter(Boolean).length ?? 0} palabras
          · {state?.text.length ?? 0} caracteres{" "}
          {state?.selected ? `· ${state.selected} seleccionados` : ""}
        </span>
        <label>
          Zoom{" "}
          <input
            aria-label="Zoom del documento"
            type="range"
            min="70"
            max="140"
            step="10"
            value={zoom}
            onChange={(e) => {
              const value = Number(e.target.value);
              setZoom(value);
              if (editor && !editor.isDestroyed)
                editor.view.dom.style.setProperty("zoom", String(value / 100));
            }}
          />
          {zoom}%
        </label>
      </div>
      <button
        type="button"
        className="word-status-toggle"
        aria-expanded={!collapsed}
        aria-label={
          collapsed ? "Mostrar barra de zoom" : "Plegar barra de zoom"
        }
        onClick={() => {
          setCollapsed(!collapsed);
          try {
            localStorage.setItem(
              "law-order-os.zoom-status-collapsed.v1",
              String(!collapsed),
            );
          } catch {
            /* Optional preference. */
          }
        }}
      >
        {collapsed ? `Zoom ${zoom}% ▴` : "▾"}
      </button>
    </div>
  );
}
