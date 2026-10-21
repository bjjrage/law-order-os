import { createPortal } from "react-dom";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { saveBlob } from "./api.js";
export const WordActions = createContext<{
  assist: (action: "CONSULT" | "ANALYZE" | "REWRITE" | "DRAFT") => void;
  open: (panel: string) => void;
  print: () => void;
  ribbonHost?: HTMLElement | null;
} | null>(null);
export function WordRibbon({
  editor,
  readOnly,
  documentActions,
}: {
  documentActions?: ReactNode;
  editor: Editor | null;
  readOnly: boolean;
}) {
  const [tab, setTab] = useState("Inicio"),
    actions = useContext(WordActions);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold"),
      italic: e?.isActive("italic"),
      underline: e?.isActive("underline"),
      strike: e?.isActive("strike"),
      bullet: e?.isActive("bulletList"),
      ordered: e?.isActive("orderedList"),
      table: e?.isActive("table"),
      heading: e?.getAttributes("heading").level ?? 0,
      font: e?.getAttributes("typography").fontFamily ?? "Times New Roman",
      size: e?.getAttributes("typography").fontSize ?? "12pt",
      align:
        e?.getAttributes("paragraph").textAlign ??
        e?.getAttributes("heading").textAlign ??
        "left",
      line: e?.getAttributes("paragraph").lineHeight ?? "1.5",
      canUndo: e?.can().undo(),
      canRedo: e?.can().redo(),
    }),
  });
  const disabled = readOnly || !editor;
  function paragraph(attrs: Record<string, unknown>) {
    editor
      ?.chain()
      .focus()
      .updateAttributes("paragraph", attrs)
      .updateAttributes("heading", attrs)
      .run();
  }
  const ribbon = (
    <div
      className="word-ribbon"
      title="Atajos: Ctrl+B / I / U · Ctrl+S · Ctrl+F · Alt+Shift+A"
    >
      <div
        className="word-ribbon-tabs"
        role="tablist"
        aria-label="Herramientas del procesador"
      >
        {["Inicio", "Insertar", "Revisar", "Vista"].map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
        <span>Ctrl+B / I / U · Ctrl+S · Ctrl+F · Alt+Shift+A</span>
      </div>
      <div className="word-ribbon-body">
        <div
          className="word-ribbon-controls"
          role="toolbar"
          aria-label="Formato del documento"
        >
          {tab === "Inicio" ? (
            <>
              <div
                className="word-ribbon-group"
                role="group"
                aria-label="Edición y estilos"
              >
                <div>
                  <button
                    title="Deshacer · Ctrl+Z"
                    aria-label="Deshacer"
                    disabled={disabled || !state?.canUndo}
                    onClick={() => editor?.chain().focus().undo().run()}
                  >
                    ↶
                  </button>
                  <button
                    title="Rehacer · Ctrl+Y"
                    aria-label="Rehacer"
                    disabled={disabled || !state?.canRedo}
                    onClick={() => editor?.chain().focus().redo().run()}
                  >
                    ↷
                  </button>
                  <select
                    aria-label="Estilo de párrafo"
                    disabled={disabled}
                    value={state?.heading ?? 0}
                    onChange={(e) => {
                      const level = Number(e.target.value);
                      if (level)
                        editor
                          ?.chain()
                          .focus()
                          .setHeading({ level: level as 1 | 2 | 3 })
                          .run();
                      else editor?.chain().focus().setParagraph().run();
                    }}
                  >
                    <option value={0}>Normal</option>
                    <option value={1}>Título</option>
                    <option value={2}>Sección</option>
                    <option value={3}>Subsección</option>
                  </select>
                </div>
                <small>Edición y estilos</small>
              </div>
              <div
                className="word-ribbon-group"
                role="group"
                aria-label="Fuente"
              >
                <div>
                  <select
                    aria-label="Fuente"
                    disabled={disabled}
                    value={state?.font}
                    onChange={(e) =>
                      editor
                        ?.chain()
                        .focus()
                        .setMark("typography", { fontFamily: e.target.value })
                        .run()
                    }
                  >
                    {[
                      "Times New Roman",
                      "Calibri",
                      "Arial",
                      "Georgia",
                      "Courier New",
                    ].map((font) => (
                      <option key={font}>{font}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Tamaño de fuente"
                    disabled={disabled}
                    value={state?.size}
                    onChange={(e) =>
                      editor
                        ?.chain()
                        .focus()
                        .setMark("typography", { fontSize: e.target.value })
                        .run()
                    }
                  >
                    {[9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48].map(
                      (size) => (
                        <option key={size} value={size + "pt"}>
                          {size}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <button
                    aria-label="Negrita"
                    title="Negrita · Ctrl+B"
                    aria-pressed={!!state?.bold}
                    disabled={disabled}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                  >
                    <b>N</b>
                  </button>
                  <button
                    aria-label="Cursiva"
                    title="Cursiva · Ctrl+I"
                    aria-pressed={!!state?.italic}
                    disabled={disabled}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                  >
                    <i>C</i>
                  </button>
                  <button
                    aria-label="Subrayado"
                    title="Subrayado · Ctrl+U"
                    aria-pressed={!!state?.underline}
                    disabled={disabled}
                    onClick={() =>
                      editor?.chain().focus().toggleUnderline().run()
                    }
                  >
                    <u>S</u>
                  </button>
                  <button
                    aria-label="Tachado"
                    title="Tachado"
                    aria-pressed={!!state?.strike}
                    disabled={disabled}
                    onClick={() => editor?.chain().focus().toggleStrike().run()}
                  >
                    <s>T</s>
                  </button>
                  <label title="Color del texto" className="word-color">
                    A
                    <input
                      type="color"
                      aria-label="Color del texto"
                      disabled={disabled}
                      defaultValue="#20323a"
                      onChange={(e) =>
                        editor
                          ?.chain()
                          .focus()
                          .setMark("typography", { color: e.target.value })
                          .run()
                      }
                    />
                  </label>
                  <button
                    aria-label="Resaltar texto"
                    title="Resaltar texto"
                    disabled={disabled}
                    onClick={() =>
                      editor
                        ?.chain()
                        .focus()
                        .setMark("typography", { highlight: "#fff0a6" })
                        .run()
                    }
                  >
                    ▰
                  </button>
                  <button
                    title="Quitar formato"
                    aria-label="Quitar formato"
                    disabled={disabled}
                    onClick={() =>
                      editor?.chain().focus().unsetAllMarks().run()
                    }
                  >
                    Tx
                  </button>
                </div>
                <small>Fuente</small>
              </div>
              <div
                className="word-ribbon-group"
                role="group"
                aria-label="Párrafo"
              >
                <div>
                  {(["left", "center", "right", "justify"] as const).map(
                    (align, index) => (
                      <button
                        key={align}
                        aria-label={
                          [
                            "Alinear a la izquierda",
                            "Centrar",
                            "Alinear a la derecha",
                            "Justificar",
                          ][index]
                        }
                        title={
                          [
                            "Alinear a la izquierda",
                            "Centrar",
                            "Alinear a la derecha",
                            "Justificar",
                          ][index]
                        }
                        aria-pressed={state?.align === align}
                        disabled={disabled}
                        onClick={() => paragraph({ textAlign: align })}
                      >
                        {["≡", "☰", "≡", "▤"][index]}
                      </button>
                    ),
                  )}
                  <select
                    aria-label="Interlineado"
                    disabled={disabled}
                    value={state?.line}
                    onChange={(e) => paragraph({ lineHeight: e.target.value })}
                  >
                    {["1", "1.15", "1.5", "2"].map((value) => (
                      <option key={value} value={value}>
                        {value}×
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    aria-label="Lista de viñetas"
                    title="Lista de viñetas"
                    disabled={disabled}
                    aria-pressed={!!state?.bullet}
                    onClick={() =>
                      editor?.chain().focus().toggleBulletList().run()
                    }
                  >
                    <span aria-hidden="true">•≡</span>
                  </button>
                  <button
                    aria-label="Lista numerada"
                    title="Lista numerada"
                    disabled={disabled}
                    aria-pressed={!!state?.ordered}
                    onClick={() =>
                      editor?.chain().focus().toggleOrderedList().run()
                    }
                  >
                    <span aria-hidden="true">1≡</span>
                  </button>
                  <button
                    aria-label="Aumentar sangría"
                    title="Aumentar sangría"
                    disabled={disabled}
                    onClick={() =>
                      paragraph({
                        indent: Math.min(
                          8,
                          Number(
                            editor?.getAttributes("paragraph").indent ?? 0,
                          ) + 1,
                        ),
                      })
                    }
                  >
                    ⇥
                  </button>
                  <button
                    aria-label="Reducir sangría"
                    title="Reducir sangría"
                    disabled={disabled}
                    onClick={() =>
                      paragraph({
                        indent: Math.max(
                          0,
                          Number(
                            editor?.getAttributes("paragraph").indent ?? 0,
                          ) - 1,
                        ),
                      })
                    }
                  >
                    ⇤
                  </button>
                </div>
                <small>Párrafo</small>
              </div>
              <div
                className="word-ribbon-group"
                role="group"
                aria-label="Trabajo conjunto"
              >
                <div>
                  <button
                    aria-label="Buscar y reemplazar"
                    title="Buscar · Ctrl+F"
                    onClick={() => actions?.open("search")}
                  >
                    <span aria-hidden="true">⌕</span>
                  </button>
                  <button
                    title="Analizar selección · Alt+Shift+A"
                    onClick={() => actions?.assist("ANALYZE")}
                    disabled={disabled || !actions}
                  >
                    ✦ Analizar
                  </button>
                </div>
                <div>
                  <button
                    aria-label="Reformular selección"
                    title="Reformular selección · Alt+Shift+R"
                    onClick={() => actions?.assist("REWRITE")}
                    disabled={disabled || !actions}
                  >
                    <span aria-hidden="true">✎</span>
                  </button>
                  <button
                    aria-label="Comentar selección"
                    title="Comentario · Ctrl+Alt+M"
                    onClick={() => actions?.open("comments")}
                    disabled={disabled || !actions}
                  >
                    <span aria-hidden="true">▢</span>
                  </button>
                </div>
                <small>Trabajo conjunto</small>
              </div>
            </>
          ) : tab === "Insertar" ? (
            <>
              <div className="word-ribbon-group">
                <div>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      editor
                        ?.chain()
                        .focus()
                        .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
                        .run()
                    }
                  >
                    Tabla
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      editor
                        ?.chain()
                        .focus()
                        .insertContent({ type: "pageBreak" })
                        .run()
                    }
                  >
                    Salto de página
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      editor?.chain().focus().setHorizontalRule().run()
                    }
                  >
                    Separador
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      editor?.chain().focus().toggleBlockquote().run()
                    }
                  >
                    Cita en bloque
                  </button>
                </div>
                <small>Insertar en el documento</small>
              </div>
              {state?.table ? (
                <div className="word-ribbon-group">
                  <div>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        editor?.chain().focus().addRowAfter().run()
                      }
                    >
                      Agregar fila
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        editor?.chain().focus().addColumnAfter().run()
                      }
                    >
                      Agregar columna
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() => editor?.chain().focus().deleteRow().run()}
                    >
                      Eliminar fila
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        editor?.chain().focus().mergeOrSplit().run()
                      }
                    >
                      Unir / dividir celdas
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        editor?.chain().focus().deleteTable().run()
                      }
                    >
                      Eliminar tabla
                    </button>
                  </div>
                  <small>Herramientas de tabla</small>
                </div>
              ) : null}
            </>
          ) : tab === "Revisar" ? (
            <>
              <div className="word-ribbon-group">
                <div>
                  <button
                    disabled={disabled || !actions}
                    onClick={() => actions?.assist("ANALYZE")}
                  >
                    Analizar selección
                  </button>
                  <button
                    disabled={disabled || !actions}
                    onClick={() => actions?.assist("REWRITE")}
                  >
                    Proponer redacción
                  </button>
                  <button
                    disabled={disabled || !actions}
                    onClick={() => actions?.open("comments")}
                  >
                    Comentarios
                  </button>
                  <button onClick={() => actions?.open("sources")}>
                    Fuentes
                  </button>
                  <button onClick={() => actions?.open("junta")}>
                    Junta del asunto
                  </button>
                </div>
                <small>Los agentes proponen; el humano aplica y revisa</small>
              </div>
            </>
          ) : (
            <>
              <div className="word-ribbon-group">
                <div>
                  <button onClick={() => actions?.open("outline")}>
                    Esquema del documento
                  </button>
                  <button onClick={() => actions?.print()}>
                    Imprimir / PDF
                  </button>
                  <button
                    disabled={!editor}
                    onClick={async () => {
                      if (!editor) return;
                      const { exportWord } = await import("./word-export.js");
                      saveBlob(
                        new Blob([exportWord(editor.getJSON())], {
                          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        }),
                        "documento.docx",
                      );
                    }}
                  >
                    Descargar Word
                  </button>
                </div>
                <small>Página A4 · impresión y copia editable</small>
              </div>
            </>
          )}
        </div>
        {documentActions && (
          <div className="word-ribbon-document-actions">{documentActions}</div>
        )}
      </div>
    </div>
  );
  return actions?.ribbonHost
    ? createPortal(ribbon, actions.ribbonHost)
    : ribbon;
}
