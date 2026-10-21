import { useCallback, useEffect, useMemo, useState } from "react";
import JuntaSources from "./JuntaSources.js";
import LibraryLoadProgress from "./LibraryLoadProgress.js";
import type { LibraryResearch } from "./junta-sources.js";
import LibraryReader from "./LibraryReader.js";

type Entry = {
  id: string;
  type: string;
  number: string;
  year: string;
  title: string;
  url: string;
  source: string;
  source_url: string;
  date: string;
  notes: string;
  text_indexed: boolean;
  extraction_status?: string;
};
type Catalog = {
  schema_version: number;
  fetched_at: string;
  records: Entry[];
  coverage?: { laws_pagination_exhausted: boolean };
  total?: number;
  counts?: Record<string, number>;
  years?: string[];
};
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const types = [
  "Todas",
  "Constitución",
  "Código",
  "Ley",
  "Decreto",
  "Decreto Ley",
  "Jurisprudencia",
  "Acordada",
  "Resolución",
  "Tratado",
];
const bookmarksKey = "law-order-os.library.bookmarks.v1";
export default function LibraryDocuments() {
  const [indexedCount, setIndexedCount] = useState(0);
  const updateCount = useCallback((n: number) => setIndexedCount(n), []);
  const [textMatches, setTextMatches] = useState<LibraryResearch>(),
    [searchingText, setSearchingText] = useState(false),
    [textError, setTextError] = useState("");
  const [indexed, setIndexed] = useState<
    Array<{ id: string; title: string; url: string; page_count: number }>
  >([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [catalogLoading, setCatalogLoading] = useState(true);
  const [query, setQuery] = useState(""),
    [type, setType] = useState("Todas"),
    [year, setYear] = useState(""),
    [page, setPage] = useState(1),
    [onlySaved, setOnlySaved] = useState(false);
  const [indexedOnly, setIndexedOnly] = useState(true), [reading, setReading] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setTextMatches(undefined);
    setTextError("");
    if (query.trim().length < 3) {
      setSearchingText(false);
      return () => abort.abort();
    }
    setSearchingText(true);
    const timer = setTimeout(() => {
      void fetch(
        "/local/junta/library/search?q=" + encodeURIComponent(query.trim()),
        { signal: abort.signal },
      )
        .then(async (r) => {
          if (!r.ok)
            throw Error("No se pudo completar la búsqueda en los textos.");
          return r.json();
        })
        .then((r: LibraryResearch) => {
          if (!abort.signal.aborted) setTextMatches(r);
        })
        .catch((e) => {
          if (!abort.signal.aborted) setTextError(e.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearchingText(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query]);
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(bookmarksKey) ?? "[]");
      return Array.isArray(s)
        ? s.filter((v: unknown) => typeof v === "string")
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const abort = new AbortController();
    setCatalogLoading(true);
    const timer = setTimeout(
      () => {
        if (onlySaved && !saved.length) {
          setCatalog((c) => (c ? { ...c, records: [], total: 0 } : c));
          setCatalogLoading(false);
          return;
        }
        const params = new URLSearchParams({
          q: query,
          type,
          year,
          page: String(page),
          indexed: indexedOnly ? "1" : "0",
          ...(onlySaved ? { ids: saved.join(",") } : {}),
        });
        const load = async () => {
          const response = await fetch(
            "/local/junta/library/catalog?" + params,
            { signal: abort.signal },
          );
          if (!response.ok)
            throw Error(
              "No se pudo abrir el catálogo local. Se reintentará al avanzar la carga.",
            );
          return response.json();
        };
        void load()
          .then((c: Catalog) => {
            if (!Array.isArray(c.records))
              throw Error("Formato de catálogo desconocido.");
            if (!abort.signal.aborted) {
              setCatalog(c);
              setError("");
            }
          })
          .catch((e) => {
            if (!abort.signal.aborted) setError(e.message);
          })
          .finally(() => {
            if (!abort.signal.aborted) setCatalogLoading(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, type, year, page, onlySaved, saved, indexedOnly]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/local/junta/library/coverage", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (!abort.signal.aborted && Array.isArray(c?.sources)) {
          setIndexed(c.sources);
          setIndexedCount(c.indexed_sources ?? c.sources.length);
        }
      })
      .catch(() => {});
    return () => abort.abort();
  }, []);
  const results = useMemo(() => {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
    return (catalog?.records ?? [])
      .filter(
        (r) =>
          (type === "Todas" || r.type === type) &&
          (!year || r.year === year) &&
          (!onlySaved || saved.includes(r.id)) &&
          tokens.every((t) =>
            normalize(
              `${r.type} ${r.number} ${r.title} ${r.source} ${r.year}`,
            ).includes(t),
          ),
      )
      .sort(
        (a, b) =>
          Number(b.year) - Number(a.year) ||
          a.title.localeCompare(b.title, "es"),
      );
  }, [catalog, query, type, year, onlySaved, saved]);
  const years = useMemo(
    () =>
      catalog?.years ??
      [...new Set((catalog?.records ?? []).map((r) => r.year).filter(Boolean))]
        .sort()
        .reverse(),
    [catalog],
  );
  const pages = Math.max(1, Math.ceil((catalog?.total ?? results.length) / 50));
  function bookmark(id: string) {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    try {
      localStorage.setItem(bookmarksKey, JSON.stringify(next));
      setSaved(next);
      setPage(1);
    } catch {
      setError("No se pudo guardar el favorito en este navegador.");
    }
  }
  return (
    <section
      className="library-documents"
      aria-labelledby="documents-library-title"
    >
      <header className="library-intro">
        <span className="eyebrow">CATÁLOGO DE PARAGUAY</span>
        <h2 id="documents-library-title">Encontrá el respaldo de tu trabajo</h2>
        <p>
          Normas, jurisprudencia y referencias oficiales. Buscá por número,
          título o palabras clave.
        </p>
      </header>
      <LibraryLoadProgress onCount={updateCount} />
      <div className="actions" role="group" aria-label="Disponibilidad de biblioteca">
        <button aria-pressed={indexedOnly} onClick={() => { setIndexedOnly(true); setPage(1); }}>Textos disponibles en el OS</button>
        <button aria-pressed={!indexedOnly} onClick={() => { setIndexedOnly(false); setPage(1); }}>Catálogo completo · incluye pendientes</button>
      </div>
      <details className="panel-note">
        <summary>
          Conectada a Junta · {indexedCount} publicaciones oficiales con texto
          para buscar
        </summary>
        <p>
          Las consultas del asunto buscan fragmentos en estos textos y
          referencias en el catálogo. El informe identifica las fuentes citadas
          y las que requieren cotejo.
        </p>
        <ul>
          {indexed.slice(0, 15).map((s) => (
            <li key={s.id}>
              <button className="library-document-title" onClick={() => setReading(s.id)}>{s.title}</button>{" "}
              · {s.page_count}{" "}
              {s.url.includes("bacn.gov.py/leyes-paraguayas/")
                ? "texto web"
                : "páginas"}
            </li>
          ))}
        </ul>
        {indexed.length > 15 && (
          <p>
            Se muestran 15 publicaciones. Usá el buscador para consultar el
            conjunto completo.
          </p>
        )}
        <p>
          Este conjunto es parcial. No se presume vigencia ni que todos los
          documentos del catálogo tengan texto disponible.
        </p>
      </details>
      <p className="library-official-link">
        <a
          href="https://www.csj.gov.py/legislacion"
          target="_blank"
          rel="noopener noreferrer"
        >
          Consultar relaciones normativas y vigencia informada en CSJ ↗
        </a>
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!catalog && !error && <p role="status">Cargando catálogo jurídico…</p>}
      {catalog && (
        <>
          <div className="library-counts" aria-label="Cobertura del catálogo">
            {types
              .filter((t) => t !== "Todas")
              .map((t) => (
                <button
                  key={t}
                  aria-pressed={type === t}
                  onClick={() => {
                    setType(t);
                    setPage(1);
                  }}
                >
                  <strong>
                    {(
                      catalog.counts?.[t] ??
                      catalog.records.filter((r) => r.type === t).length
                    ).toLocaleString("es-PY")}
                  </strong>{" "}
                  {t === "Ley"
                    ? "Leyes"
                    : t === "Decreto"
                      ? "Decretos"
                      : t === "Código"
                        ? "Códigos"
                        : t}
                </button>
              ))}
          </div>
          <div className="list-toolbar">
            <label className="search">
              <span className="sr-only">Buscar documentos jurídicos</span>
              <input
                aria-label="Buscar documentos jurídicos"
                placeholder="Número de ley, contrato, laboral, sentencia…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              Tipo{" "}
              <select
                aria-label="Tipo de documento jurídico"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
              >
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Año{" "}
              <select
                aria-label="Año del documento"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={onlySaved}
                onChange={(e) => {
                  setOnlySaved(e.target.checked);
                  setPage(1);
                }}
              />{" "}
              Mis favoritos
            </label>
          </div>
          {searchingText && (
            <p role="status">Buscando en los textos oficiales…</p>
          )}
          {textError && <p role="alert">{textError}</p>}
          {textMatches && (
            <JuntaSources
              onOpenSource={setReading}
              research={{
                ...textMatches,
                sources: textMatches.sources
                  .filter(
                    (s) =>
                      type === "Todas" ||
                      s.document_type === type ||
                      (type === "Jurisprudencia" &&
                        s.kind === "OFFICIAL_CASELAW"),
                  )
                  .filter((s) => !year || s.title.includes(year)),
              }}
              title="Coincidencias en el texto oficial"
            />
          )}
          <p role="status">
            {catalogLoading
              ? "Actualizando catálogo…"
              : `${(catalog.total ?? results.length).toLocaleString("es-PY")} resultados · página ${page} de ${pages}`}
          </p>
          <div className="table-scroll">
            <table aria-busy={catalogLoading}>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tipo / año</th>
                  <th>Fuente y alcance</th>
                  <th>Guardar</th>
                </tr>
              </thead>
              <tbody>
                {(catalog.total === undefined
                  ? results.slice((page - 1) * 50, page * 50)
                  : results
                ).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.text_indexed ? <button className="library-document-title" onClick={() => setReading(r.id)}>
                        {r.number && `${r.type} ${r.number} · `}{r.title}
                      </button> : <a href={r.url} target="_blank" rel="noopener noreferrer">
                        {r.number && `${r.type} ${r.number} · `}
                        {r.title} ↗
                      </a>}
                    </td>
                    <td>
                      <span className="badge">{r.type}</span>
                      <div>{r.year || "Año sin cotejar"}</div>
                    </td>
                    <td>
                      <span>{r.source}</span>
                      <p className="muted">
                        {r.text_indexed
                          ? r.extraction_status === "PARTIAL_TEXT_UNREVIEWED"
                            ? "Lectura parcial disponible para la Junta"
                            : r.extraction_status === "OCR_TEXT_UNREVIEWED"
                              ? "Escaneo leído · disponible para la Junta"
                              : "Texto disponible para la Junta"
                          : "Referencia localizada · texto pendiente"}
                      </p>
                      <details>
                        <summary>Datos de la referencia</summary>
                        <p>{r.notes}</p>
                        {r.date && (
                          <p>Fecha publicada en el registro: {r.date}</p>
                        )}
                        <a
                          href={r.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Procedencia oficial ↗
                        </a>
                        <p>
                          Vigencia y aplicabilidad pendientes de cotejo con la
                          publicación original.
                        </p>
                      </details>
                    </td>
                    <td>
                      <button
                        aria-label={`${saved.includes(r.id) ? "Quitar favorito" : "Guardar favorito"} ${r.id}`}
                        aria-pressed={saved.includes(r.id)}
                        onClick={() => bookmark(r.id)}
                      >
                        {saved.includes(r.id) ? "★" : "☆"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!catalogLoading && !results.length && (
            <p className="empty">
              No hay coincidencias en el catálogo incorporado. Probá otro
              término o consultá los buscadores oficiales en Fuentes.
            </p>
          )}
          <div className="actions">
            <button
              disabled={catalogLoading || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              disabled={catalogLoading || page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
          <details className="library-coverage">
            <summary>Cobertura y actualización del catálogo</summary>
            <p>
              Consultado: {new Date(catalog.fetched_at).toLocaleString("es-PY")}
              . El inventario reúne leyes del Congreso, decretos de Presidencia
              y del MEF, legislación, acordadas y registros de jurisprudencia de
              la Corte. El avance por repositorio aparece al comienzo de esta
              pantalla.
            </p>
            <p>
              La búsqueda consulta el texto de los documentos incorporados y los
              títulos del catálogo. Los registros sin texto, escaneados o con
              descarga fallida no se presentan como fuentes leídas. No se
              certifica vigencia ni cobertura histórica completa.
            </p>
            <p>
              La Junta busca automáticamente en los títulos del catálogo y en el
              conjunto de textos oficiales recuperados. En cada consulta muestra
              las publicaciones, páginas y fragmentos seleccionados, y distingue
              las fuentes citadas de las referencias sin texto. La cobertura de
              texto es parcial; no equivale a tener todas estas referencias
              leídas.
            </p>
            <p>
              Desde un asunto, abrí Consultar Junta y usá «Buscar fuentes · sin
              gasto de IA» para revisar la búsqueda antes de ejecutar el
              análisis. Los favoritos se guardan en este navegador y no están
              incluidos en el respaldo de asuntos.
            </p>
          </details>
        </>
      )}
      {reading && <LibraryReader key={reading} id={reading} onClose={() => setReading(null)} />}
    </section>
  );
}
