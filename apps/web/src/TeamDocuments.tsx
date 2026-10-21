import type { Document } from '../../../os-core/src/contracts.js';
import type { TeamDocumentInfo } from './local-team.js';

function fileSize(bytes: number) { return bytes < 1024 ? bytes + ' B' : bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + ' KB' : (bytes / (1024 * 1024)).toLocaleString('es-PY', { maximumFractionDigits: 1 }) + ' MB'; }
function uploadedAt(value: string) { return new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
export default function TeamDocuments({ documents, metadata, selected, busy, disabled, exampleDisabled, notice, onSelect, onStatus, onDownload, onExample }: {
  documents: Document[]; metadata: TeamDocumentInfo[]; selected: string[]; busy: boolean; disabled: boolean; exampleDisabled: boolean; notice: string;
  onSelect: (id: string, checked: boolean) => void;
  onStatus: (document: TeamDocumentInfo, action: 'REMOVE' | 'RESTORE') => void;
  onDownload: (documentId: string, versionId: string, filename: string) => void;
  onExample: () => void;
}) {
  const info = new Map(metadata.map(item => [item.document_id, item]));
  const examples = documents.filter(document => info.get(document.id)?.source === 'EXAMPLE');
  const files = documents.filter(document => info.get(document.id)?.source !== 'EXAMPLE');
  const removed = metadata.filter(item => item.removed);
  function file(document: Document) {
    const details = info.get(document.id), filename = details?.original_filename ?? document.title;
    return <div className="evidence-document" key={document.id}>
      <label className="evidence-option"><input type="checkbox" disabled={disabled} checked={selected.includes(document.id)} onChange={event => onSelect(document.id, event.target.checked)} /><span>
        <strong>{document.title}</strong><small className="document-source">{details?.source === 'EXAMPLE' ? 'Ejemplo de prueba' : document.purpose === 'DRAFT' ? 'Borrador del equipo' : 'Archivo adjunto'}</small>
        {details && filename !== document.title && <small className="document-filename">{filename}</small>}
        {details && <small>{details.mime_type === 'application/pdf' ? 'PDF' : details.mime_type.includes('wordprocessingml') ? 'Word' : 'TXT'} · {fileSize(details.size_bytes)} · {uploadedAt(details.incorporated_at)}</small>}
        <small>{!details ? 'Leyendo información del archivo…' : details.status === 'UNREADABLE' ? 'Sin texto legible · requiere OCR/revisión' : details.status === 'REVIEW_REQUIRED' ? 'Extracción con observaciones' : 'Texto disponible para consulta'}</small>
      </span></label>
      {details?.duplicate_of && <small className="extraction-warning">Mismo contenido que «{details.duplicate_of.title}». Podés eliminar esta copia.</small>}
      {details?.warnings.map((warning, i) => <small className="extraction-warning" key={i}>{warning}</small>)}
      {details?.preview && <details className="document-preview"><summary>Ver contenido</summary><small>Vista previa del texto. Descargá el original para verlo completo.</small><blockquote>{details.preview}…</blockquote></details>}
      <div className="document-file-actions">
        {document.current_version_id && <button className="text-action" disabled={busy} onClick={() => onDownload(document.id, document.current_version_id!, filename)}>Descargar original</button>}
        {document.purpose === 'ORIGINAL' && details && <button className="text-action document-remove" disabled={disabled} aria-label={'Eliminar ' + filename} onClick={() => onStatus(details, 'REMOVE')}>Eliminar</button>}
      </div>
    </div>;
  }
  return <aside className="evidence-rail" aria-label="Documentos del asunto">
    <div className="section-heading"><h3>Documentos del asunto</h3></div>
    <p className="document-count"><strong>{documents.length} {documents.length === 1 ? 'archivo guardado' : 'archivos guardados'}</strong><br />{selected.length === 0 ? 'Ninguno seleccionado para esta consulta' : `${selected.length} ${selected.length === 1 ? 'seleccionado' : 'seleccionados'} para esta consulta`}</p>
    <p className="muted">Marcá los archivos que usará el equipo. Desmarcar los excluye de esta consulta. Eliminar los envía a la papelera.</p>
    {notice && <p className="document-management-notice" role="status">{notice}</p>}
    {files.length ? files.map(file) : <p>Adjuntá tu contrato o sus anexos junto a la pregunta.</p>}
    {examples.length > 0 && <details className="example-documents"><summary>Ejemplos de prueba · {examples.length}</summary><p>Estos archivos se agregaron con Cargar ejemplo sintético.</p>{examples.map(file)}</details>}
    <details className="example-documents"><summary>Probar con documentos de ejemplo</summary><p>Agrega un contrato y un anexo ficticios para probar el flujo. Se identifican como ejemplos.</p><button disabled={exampleDisabled} onClick={onExample}>Cargar ejemplo sintético</button></details>
    {removed.length > 0 && <details className="document-trash"><summary>Documentos eliminados · {removed.length}</summary><p>Se conservan en la papelera para poder restaurarlos y mantener las consultas anteriores.</p>{removed.map(item => <div key={item.document_id} className="trashed-document"><strong>{item.original_filename}</strong><small>{item.source === 'EXAMPLE' ? 'Ejemplo de prueba' : 'Archivo adjunto'} · {fileSize(item.size_bytes)}</small><button disabled={disabled} aria-label={'Restaurar ' + item.original_filename} onClick={() => onStatus(item, 'RESTORE')}>Restaurar</button></div>)}</details>}
    <small>Originales completos · PDF, Word y TXT. Sin servicios externos.</small>
  </aside>;
}
