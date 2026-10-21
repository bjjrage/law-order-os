declare module '*pdfjs-dist/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(options: Record<string, unknown>): { promise: Promise<{ numPages: number; getPage(number: number): Promise<{ getTextContent(): Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>; cleanup(): void }> }>; destroy(): Promise<void> };
}
