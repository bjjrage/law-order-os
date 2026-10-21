import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Document } from '../../../os-core/src/contracts.js';
import { api } from './api.js';
import { documentFormat, documentMime, MAX_DOCUMENTS, MAX_FILE_BYTES, MAX_BATCH_BYTES } from './document-policy.js';
import type { Extraction } from './document-extraction-contract.js';

type Payload = { command_id: string; synthetic_data: true; max_cost_usd: 0; files: Array<{ title: string; original_filename: string; original_base64: string; mime_type: typeof documentMime[keyof typeof documentMime]; extraction: Extraction }> };
export default function TeamDocumentUpload({ base, disabled, consent, noticeRevision = 0, onBusy, onIncorporated, inputRef, compact = false }: { base: string; disabled: boolean; consent: boolean; noticeRevision?: number; onBusy: (busy: boolean) => void; onIncorporated: (documents: Document[], ids: string[]) => Promise<void>; inputRef?: RefObject<HTMLInputElement | null>; compact?: boolean }) {
  const ownInput = useRef<HTMLInputElement>(null), input = inputRef ?? ownInput, pending = useRef<Payload | null>(null);
  const [dragging, setDragging] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [retry, setRetry] = useState(false);
  const [progress, setProgress] = useState('');
  useEffect(() => { setNotice(''); }, [noticeRevision]);
  async function commit(payload: Payload) {
    const result = await api<{ document_ids: string[]; reused_document_ids: string[]; removed_document_ids: string[] }>(base + '/legal-team/documents', payload);
    const documents = await api<Document[]>(base + '/documents');
    await onIncorporated(documents, result.document_ids);
    const warnings = payload.files.filter(file => file.extraction.status !== 'COMPLETE_UNREVIEWED');
    const readable = payload.files.filter(file => file.extraction.status !== 'UNREADABLE' && file.extraction.units.every(unit => unit.readable)).length;
    const reused = result.reused_document_ids.length, removed = result.removed_document_ids.length;
    pending.current = null; setRetry(false);
    setNotice(removed ? `${removed} ${removed === 1 ? 'archivo ya está' : 'archivos ya están'} en la papelera. Podés restaurarlos desde Documentos eliminados.${result.document_ids.length > removed ? ' Los demás archivos quedaron disponibles en el asunto.' : ''} No se crearon copias de los archivos eliminados.`
      : reused === result.document_ids.length ? `Este ${reused === 1 ? 'archivo ya estaba' : 'grupo de archivos ya estaba'} en el asunto. No se crearon copias.${warnings.length ? ' Revisá las observaciones de extracción antes de preparar.' : ''}`
      : readable === payload.files.length ? `${result.document_ids.length} ${result.document_ids.length === 1 ? 'documento incorporado al asunto y seleccionado' : 'documentos incorporados al asunto y seleccionados'} para la consulta.${reused ? ` ${reused} ya estaban guardados; no se duplicaron.` : ''}${warnings.length ? ' Revisá las observaciones de extracción en la lista de evidencia antes de preparar.' : ''}`
      : `${result.document_ids.length} ${result.document_ids.length === 1 ? 'original guardado completo' : 'originales guardados completos'}. Los que no tienen extracción completa requieren revisión/OCR y no se seleccionaron para analizar.`);
  }
  async function upload(files: File[]) {
    if (busy || disabled || !consent || !files.length) return;
    setBusy(true); onBusy(true); setError(''); setNotice(''); setRetry(false); pending.current = null;
    try {
      if (files.length > MAX_DOCUMENTS || files.some(file => !file.size || file.size > MAX_FILE_BYTES) || files.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_BYTES) throw Error('EVIDENCE_LIMIT');
      const { extractDocument } = await import('./document-extraction.js');
      const contents: Payload['files'] = [];
      for (const file of files) {
        const format = documentFormat(file.name);
        const bytes = new Uint8Array(await file.arrayBuffer());
        setProgress('Leyendo ' + file.name + '…');
        const extraction = await extractDocument(bytes, file.name, message => setProgress(file.name + ' · ' + message));
        const chunks: string[] = []; for (let offset = 0; offset < bytes.length; offset += 32768) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
        contents.push({ title: file.name.replace(/\.(?:txt|pdf|docx)$/iu, '').slice(0, 240) || file.name, original_filename: file.name.slice(0, 240), mime_type: documentMime[format], original_base64: btoa(chunks.join('')), extraction });
      }
      pending.current = { command_id: crypto.randomUUID(), synthetic_data: true, max_cost_usd: 0, files: contents };
      await commit(pending.current);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : '';
      setError(code === 'EVIDENCE_LIMIT' ? `Adjuntá hasta ${MAX_DOCUMENTS} documentos, 20 MB por archivo y 50 MB por carga.` : code === 'DOCUMENT_FORMAT_UNSUPPORTED' ? 'Podés adjuntar PDF, Word (.docx) y TXT. Para un Word antiguo (.doc), guardalo como DOCX.' : 'No se pudo completar la carga. Los originales anteriores se conservan; podés reintentar sin duplicarlos.');
      setRetry(Boolean(pending.current));
    } finally { setBusy(false); setProgress(''); onBusy(false); if (input.current) input.current.value = ''; }
  }
  return <div className={'team-document-upload' + (compact ? ' workspace-upload-compact' : '') + (dragging ? ' is-dragging' : '')} onDragOver={event => { event.preventDefault(); if (!disabled && consent) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
    <div className="document-upload-prompt"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8M7 13l7-7" /></svg><span><strong>Documentos para esta consulta</strong><small>{!consent ? 'Confirmá los datos sintéticos del encargo para adjuntar.' : 'Arrastrá documentos acá o elegilos desde tu equipo.'} Se guardan como originales del asunto.</small></span><button type="button" disabled={disabled || busy || !consent} aria-busy={busy} onClick={() => input.current?.click()}>{busy ? 'Incorporando…' : 'Adjuntar documentos'}</button></div>
    <input ref={input} className="sr-only" type="file" multiple accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Adjuntar documentos a la consulta" disabled={disabled || busy || !consent} onChange={event => { void upload(Array.from(event.target.files ?? [])); }} />
    <small>PDF, Word (.docx) y TXT · 20 MB por archivo · hasta {MAX_DOCUMENTS} documentos y 50 MB por carga. Extracción local; originales completos.</small>
    {progress && <p role="status">{progress}</p>}
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="upload-notice" role="status">{notice}</p>}
    {retry && <button type="button" disabled={disabled || busy || !consent} onClick={async () => { if (!pending.current || busy) return; setBusy(true); onBusy(true); setError(''); try { await commit(pending.current); } catch { setError('No se pudo completar la carga. Los archivos anteriores se conservan.'); } finally { setBusy(false); onBusy(false); } }}>Reintentar carga</button>}
  </div>;
}
