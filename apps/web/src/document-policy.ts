export const MAX_DOCUMENTS = 12;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_BATCH_BYTES = 50 * 1024 * 1024;
export const MAX_TEXT_CHARS = 4 * 1024 * 1024;
export const MAX_SELECTED_TEXT_BYTES = 4 * 1024 * 1024;
export const MAX_OUTPUT_CHARS = 64 * 1024 * 1024;
export const documentMime = { txt: 'text/plain', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as const;
export type DocumentFormat = keyof typeof documentMime;
export function documentFormat(filename: string): DocumentFormat {
  const extension = filename.split('.').at(-1)?.toLowerCase();
  if (extension !== 'txt' && extension !== 'pdf' && extension !== 'docx') throw Error('DOCUMENT_FORMAT_UNSUPPORTED');
  return extension;
}
