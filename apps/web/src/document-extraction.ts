import { unzipSync } from 'fflate';
import { sha256 } from '../../../os-core/src/bytes.js';
import { documentFormat, MAX_FILE_BYTES, MAX_TEXT_CHARS } from './document-policy.js';
import { ExtractionSchema, type Extraction } from './document-extraction-contract.js';

/** Local extraction only. Original bytes are preserved independently; embedded instructions never execute. */
export async function extractDocument(bytes: Uint8Array, filename: string, onProgress: (message: string) => void = () => {}): Promise<Extraction> {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw Error('DOCUMENT_FILE_LIMIT');
  const format = documentFormat(filename), original_sha256 = await sha256(bytes);
  const units: Extraction['units'] = [], warnings: string[] = [];
  let text = '', status: Extraction['status'] = 'COMPLETE_UNREVIEWED';
  const method = format === 'txt' ? 'UTF8' : format === 'pdf' ? 'PDF_TEXT' : 'DOCX_XML';
  function append(label: string, content: string) {
    const start = text.length, readable = Boolean(content.trim());
    text += (text ? '\n\n' : '') + '[' + label + ']\n' + (readable ? content : '[TEXTO NO EXTRAÍDO: revisión necesaria]');
    units.push({ label, start, end: text.length, readable });
    if (text.length > MAX_TEXT_CHARS) throw Error('DOCUMENT_TEXT_LIMIT');
  }
  try {
    if (format === 'txt') {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (/^%PDF-|^PK\u0003\u0004/u.test(text) || text.includes('\u0000')) throw Error('DOCUMENT_CONTENT_MISMATCH');
      if (text.length > MAX_TEXT_CHARS) throw Error('DOCUMENT_TEXT_LIMIT');
      units.push({ label: 'Texto completo', start: 0, end: text.length, readable: Boolean(text.trim()) });
      if (!text.trim()) status = 'UNREADABLE';
    } else if (format === 'pdf') {
      if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) throw Error('DOCUMENT_CONTENT_MISMATCH');
      onProgress('Abriendo PDF localmente…');
      const pdfjs = await import('../../../phase2/tooling/node_modules/pdfjs-dist/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf-worker.js';
      const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), isEvalSupported: false, useSystemFonts: true, disableFontFace: true, useWorkerFetch: false, cMapUrl: '/vendor/pdfjs-cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs-fonts/' });
      try {
        const pdf = await task.promise;
        if (pdf.numPages > 500) throw Error('DOCUMENT_PAGE_LIMIT');
        for (let number = 1; number <= pdf.numPages; number++) {
          onProgress(`Extrayendo página ${number} de ${pdf.numPages}…`);
          const page = await pdf.getPage(number), content = await page.getTextContent();
          const value = content.items.filter((item): item is { str: string; hasEOL: boolean } & typeof item => 'str' in item).map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
          append('Página ' + number, value); page.cleanup();
          if (!value.trim()) { status = 'REVIEW_REQUIRED'; warnings.push(`Página ${number} sin texto extraíble; puede requerir OCR.`); }
        }
      } finally { await task.destroy(); }
    } else {
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw Error('DOCUMENT_CONTENT_MISMATCH');
      onProgress('Extrayendo documento Word localmente…');
      let expanded = 0;
      const parts = unzipSync(bytes, { filter: entry => {
        const selected = /^word\/(?:document|footnotes|endnotes|header\d*|footer\d*)\.xml$/u.test(entry.name);
        if (selected) { expanded += entry.originalSize; if (expanded > 32 * 1024 * 1024) throw Error('DOCUMENT_TEXT_LIMIT'); }
        return selected;
      } });
      if (!parts['word/document.xml']) throw Error('DOCUMENT_CONTENT_MISMATCH');
      const names = Object.keys(parts).sort((a, b) => a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b));
      for (const name of names) {
        const xml = new TextDecoder('utf-8', { fatal: true }).decode(parts[name]!);
        if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw Error('DOCUMENT_CONTENT_MISMATCH');
        const parsed = new DOMParser().parseFromString(xml, 'application/xml');
        if (parsed.getElementsByTagName('parsererror').length) throw Error('DOCUMENT_CONTENT_MISMATCH');
        if (parsed.getElementsByTagNameNS('*', 'ins').length || parsed.getElementsByTagNameNS('*', 'del').length) { status = 'REVIEW_REQUIRED'; warnings.push('Word contiene cambios controlados; se conserva el texto insertado y eliminado para revisión.'); }
        if (parsed.getElementsByTagNameNS('*', 'drawing').length || parsed.getElementsByTagNameNS('*', 'object').length) { status = 'REVIEW_REQUIRED'; warnings.push('Word contiene imágenes u objetos cuyo texto requiere revisión.'); }
        const paragraphs = Array.from(parsed.getElementsByTagNameNS('*', 'p')).map(paragraph => Array.from(paragraph.querySelectorAll('*')).map(node => node.localName === 't' ? node.textContent ?? '' : node.localName === 'delText' ? '[ELIMINADO: ' + (node.textContent ?? '') + ']' : node.localName === 'tab' ? '\t' : node.localName === 'br' ? '\n' : '').join('')).join('\n');
        append(name, paragraphs);
      }
    }
  } catch (reason) {
    // Preserve the original but never offer partial or absent extraction as complete evidence.
    text = ''; units.length = 0; status = 'UNREADABLE';
    const code = reason instanceof Error ? reason.message : '';
    warnings.push(code === 'DOCUMENT_TEXT_LIMIT' ? 'El texto supera la capacidad de esta extracción; el original se conserva completo, sin recortes.' : code === 'DOCUMENT_PAGE_LIMIT' ? 'PDF de más de 500 páginas: requiere una extracción por partes. El original se conserva completo.' : /password/iu.test(code) ? 'PDF protegido con contraseña; incorporá una copia accesible para consultar su texto.' : 'No se pudo extraer texto legible. Revisá el archivo o incorporá una versión con texto/OCR.');
  }
  if (!units.some(unit => unit.readable)) status = 'UNREADABLE';
  return ExtractionSchema.parse({ format, method, status, text, text_sha256: await sha256(new TextEncoder().encode(text)), original_sha256, units, warnings, extractor_version: 'local-document-v1', truncated: false });
}
