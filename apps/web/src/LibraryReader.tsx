import { useEffect, useRef, useState } from "react";
import "./library-reader.css";

type Document = {
  id: string; title: string; publisher: string; source_url: string | null;
  page_count: number; content_format: string; extraction_status: string;
  original_available: boolean; offset: number; next_offset: number | null;
  passages: Array<{ page: number; start: number; text: string; locator: string | null }>;
};
export default function LibraryReader({ id, onClose }: { id: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), body = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<Document>(), [offset, setOffset] = useState(0);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError("");
    void fetch(`/local/junta/library/document?id=${encodeURIComponent(id)}&offset=${offset}`, { signal: abort.signal })
      .then(async response => { const value = await response.json(); if (!response.ok) throw Error(value.error ?? "No se pudo abrir el texto guardado."); return value as Document; })
      .then(value => { if (!abort.signal.aborted) { setDocument(value); body.current?.scrollTo(0, 0); } })
      .catch(reason => { if (!abort.signal.aborted) setError(reason.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [id, offset]);
  const pages = new Map<number, { text: string; end: number; start: number; locator: string | null }>();
  for (const passage of document?.passages ?? []) {
    const prior = pages.get(passage.page);
    if (!prior) pages.set(passage.page, { text: passage.text, start: passage.start, end: passage.start + passage.text.length, locator: passage.locator });
    else {
      prior.text += passage.start > prior.end ? "\n[…]\n" + passage.text : passage.text.slice(Math.max(0, prior.end - passage.start));
      prior.end = Math.max(prior.end, passage.start + passage.text.length);
    }
  }
  return <dialog ref={dialog} className="library-reader" aria-labelledby="library-reader-title" onCancel={onClose} onClose={onClose}>
    <header><div><span className="eyebrow">BIBLIOTECA DEL ESTUDIO · TEXTO GUARDADO</span><h2 id="library-reader-title">{document?.title ?? "Abriendo publicación…"}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar publicación">×</button></header>
    {document && <div className="library-reader-tools">
      <span>{document.publisher} · {document.page_count} {document.content_format === "HTML" ? "secciones" : "páginas"}</span>
      {document.original_available && <a className="button" href={`/local/junta/library/original?id=${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer">{document.content_format === "PDF" ? "Abrir PDF guardado ↗" : "Descargar original guardado"}</a>}
      {document.source_url && <a href={document.source_url} target="_blank" rel="noopener noreferrer">Fuente oficial ↗</a>}
    </div>}
    <div className="library-reader-body" ref={body} aria-busy={loading}>
      {loading ? <p role="status">Abriendo texto local…</p> : error ? <p role="alert">{error}</p> : <>
        <p className="panel-note">Texto extraído para consulta. {document?.extraction_status === "PARTIAL_TEXT_UNREVIEWED" ? "La lectura es parcial y puede omitir páginas. " : ""}Cotejá citas, lectura de escaneos y vigencia con la publicación original.</p>
        {[...pages].map(([number, page]) => <section key={number}><h3>{document?.content_format === "HTML" ? page.locator ?? "Texto de la publicación" : `Página ${number}`}{page.start > 0 ? " · continuación" : ""}</h3><p className="library-reader-text">{page.text}</p></section>)}
        {!pages.size && <p>No hay fragmentos en este tramo de la publicación.</p>}
      </>}
    </div>
    <footer><button disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 40))}>← Tramo anterior</button><span>Lectura dentro del OS</span><button disabled={loading || document?.next_offset == null} onClick={() => setOffset(document!.next_offset!)}>Continuar lectura →</button></footer>
  </dialog>;
}
