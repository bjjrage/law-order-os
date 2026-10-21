// Backward-compatible command: use the resumable full-text corpus pipeline.
import {syncCorpus} from './library-corpus-ingest.mjs';
await syncCorpus();
