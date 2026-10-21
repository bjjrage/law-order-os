import { useEffect, useState } from "react";
type Load = {
  status: string;
  phase?: string;
  indexed_documents?: number;
  discovered_documents?: number;
  indexed_passages?: number;
  ocr_documents?: number;
  ocr_this_run?: number;
  current_document?: {
    title: string;
    page: number | null;
    total_pages: number | null;
    reading_scan?: boolean;
  } | null;
  current_source?: { source: string; records?: number } | null;
  sources?: Record<
    string,
    { records: number; complete: boolean; error?: string }
  >;
  error?: string;
};
const names: Record<string, string> = {
  BACN: "Leyes del Congreso",
  PRESIDENCIA: "Decretos de Presidencia",
  MEF: "Decretos del MEF",
  ACORDADAS: "Acordadas de la Corte",
  CSJ_LEGISLACION: "Legislación de la Corte",
  CSJ_JURISPRUDENCIA: "Jurisprudencia de la Corte",
};
export default function LibraryLoadProgress({
  onCount,
}: {
  onCount: (n: number) => void;
}) {
  const [state, setState] = useState<Load | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    let pending = false;
    const update = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/local/junta/library/progress", {
          signal: abort.signal,
        });
        if (response.ok) {
          const next: Load = await response.json();
          if (!abort.signal.aborted) {
            setState(next);
            if (next.indexed_documents !== undefined)
              onCount(next.indexed_documents);
          }
        }
      } catch {
      } finally {
        pending = false;
      }
    };
    void update();
    const timer = setInterval(() => void update(), 3500);
    return () => {
      clearInterval(timer);
      abort.abort();
    };
  }, [onCount]);
  if (!state || state.status === "NOT_STARTED") return null;
  const active = state.status === "RUNNING",
    total = state.discovered_documents ?? 0,
    indexed = state.indexed_documents ?? 0;
  return (
    <section
      className="library-load panel-note"
      aria-label="Carga automática de la Biblioteca"
    >
      <h3>
        {active
          ? "Actualización automática en curso"
          : state.status === "COMPLETED_AVAILABLE_QUEUE"
            ? "Carga disponible procesada"
            : "La carga requiere revisión"}
      </h3>
      <p>
        <strong>
          {indexed.toLocaleString("es-PY")} documentos consultables
        </strong>{" "}
        · {total.toLocaleString("es-PY")} referencias relevadas ·{" "}
        {(state.indexed_passages ?? 0).toLocaleString("es-PY")} fragmentos
        buscables.
      </p>
      <details className="library-load-details">
        <summary>Ver avance y alcance de la carga</summary>
        {!!state.ocr_documents && (
          <p>
            {state.ocr_documents.toLocaleString("es-PY")} documentos con páginas
            recuperadas de escaneos.
          </p>
        )}
        {total > 0 && (
          <progress
            aria-label="Documentos del inventario incorporados"
            max={Math.max(total, indexed)}
            value={indexed}
          />
        )}
        {active && (
          <p role="status">
            {state.current_document ? (
              <>
                {state.current_document.reading_scan
                  ? "Leyendo PDF escaneado"
                  : "Procesando documento"}
                : {state.current_document.title}
                {state.current_document.page
                  ? " · página " +
                    state.current_document.page +
                    " de " +
                    state.current_document.total_pages
                  : ""}
              </>
            ) : (
              <>
                Relevando{" "}
                {names[state.current_source?.source ?? ""] ??
                  "repositorios oficiales"}
                …
              </>
            )}
          </p>
        )}
        {state.status === "INTERRUPTED" && (
          <p>
            La carga se interrumpió. El OS intenta retomarla automáticamente
            mientras está abierto y al volver a iniciarlo; los documentos
            guardados se conservan.
          </p>
        )}
        {state.error && (
          <p>
            {state.error === "DISK_RESERVE_REACHED"
              ? "La carga se detuvo para conservar espacio libre en el disco."
              : "Una fuente o tarea no pudo completarse. Los documentos incorporados siguen disponibles."}
          </p>
        )}
        <ul>
          {Object.entries(state.sources ?? {}).map(([id, s]) => (
            <li key={id}>
              {names[id] ?? id}: {s.records.toLocaleString("es-PY")} referencias
              ·{" "}
              {s.error
                ? "requiere revisión"
                : s.complete
                  ? "listado relevado"
                  : "en curso"}
            </li>
          ))}
        </ul>
        <p>
          La carga consulta repositorios públicos y lee los escaneos localmente,
          sin llamadas pagas. Las referencias relevadas todavía no equivalen a
          textos leídos. No se certifica cobertura universal ni vigencia de
          todas las normas.
        </p>
      </details>
    </section>
  );
}
