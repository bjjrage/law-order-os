import { hash } from '../domain/guards.js';
import { extractCitationsCore, CITATION_FAMILIES, type CitationFamily, type ExtractionReport } from './extraction-core.js';
export * from './extraction-core.js';

// Preserve legacy parser behavior and reference IDs; the core can also run offline in browsers.
export function extractCitations(text:string,jurisdiction:string,families:readonly CitationFamily[]=CITATION_FAMILIES):ExtractionReport {
  return extractCitationsCore(text,jurisdiction,(raw,start)=>'free:'+start+':'+hash(raw).slice(0,12),families);
}
