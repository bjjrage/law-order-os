import { DocumentSchema, type AccessContext, type Citation, type EvidenceSnapshot, type LegalDocument, type LegalResearchRequest, type Passage, type Scope } from '../domain/contracts.js';
import { assertAccess, BoardError, frozenCopy, hash } from '../domain/guards.js';

export interface SemanticAdapter { search(query: string, permitted: readonly Passage[], limit: number): Promise<string[]> }
export interface LegalEvidenceProvider {
  snapshot(actor: AccessContext, scope: Scope): EvidenceSnapshot;
  search(actor: AccessContext, request: LegalResearchRequest, snapshot: EvidenceSnapshot, limit: number): Promise<Passage[]>;
  byMetadata(actor: AccessContext, scope: Scope, snapshot: EvidenceSnapshot, metadata: Partial<LegalDocument['metadata']>): LegalDocument[];
  passage(actor: AccessContext, scope: Scope, snapshot: EvidenceSnapshot, documentId: string, passageId: string): Passage;
  documents(actor: AccessContext, scope: Scope, snapshot: EvidenceSnapshot): LegalDocument[];
}
export interface CitationResolver { resolve(citation: Citation, documents: readonly LegalDocument[]): LegalDocument[] }
export function passagesOf(doc: LegalDocument): Passage[] {
  return doc.text_spans.map(p => ({...p, document_id: doc.document_id, document_version_id: doc.document_version_id, source_id: doc.document_id, source_type: doc.source_type, original_hash_sha256: doc.original_hash_sha256, extraction_quality: doc.extraction_quality, source_metadata:doc.metadata,is_test_fixture:doc.is_test_fixture }));
}
export class LocalEvidenceIndex implements LegalEvidenceProvider {
  private readonly versions = new Map<string, LegalDocument>();
  private readonly currentVersions = new Map<string, string>();
  constructor(documents: LegalDocument[], private readonly semantic?: SemanticAdapter, currentVersions: Readonly<Record<string,string>> = {}) {
    documents.forEach(d=>this.add(d));
    for(const [documentId,versionId] of Object.entries(currentVersions))this.publishVersion(documentId,versionId);
  }
  // Explicit host/operator publication. Version names and load order convey no authority.
  publishVersion(documentId:string,versionId:string):void {
    const version=this.versions.get(versionId);
    if(!version || version.document_id!==documentId)throw new BoardError('CURRENT_DOCUMENT_VERSION_NOT_REGISTERED');
    this.currentVersions.set(documentId,versionId);
  }
  add(document: LegalDocument): void {
    document=DocumentSchema.parse(document);
    const identity=[...this.versions.values()].find(d=>d.document_id===document.document_id);
    if(identity && (identity.study_id!==document.study_id || identity.matter_id!==document.matter_id || identity.source_type!==document.source_type))throw new BoardError('DOCUMENT_ID_SCOPE_CONFLICT');
    const existing = this.versions.get(document.document_version_id);
    if (existing && hash(existing) !== hash(document)) throw new BoardError('IMMUTABLE_DOCUMENT_VERSION');
    this.versions.set(document.document_version_id, frozenCopy(document));
  }
  snapshot(actor: AccessContext, scope: Scope): EvidenceSnapshot {
    assertAccess(actor,scope);
    const scopedIdentity={study_id:scope.study_id,matter_id:scope.matter_id};
    const groups=new Map<string,LegalDocument[]>();
    for(const document of this.versions.values()){
      if(document.source_type==='PRIVATE_MATTER' && (document.study_id!==scope.study_id || document.matter_id!==scope.matter_id))continue;
      const group=groups.get(document.document_id)??[];group.push(document);groups.set(document.document_id,group);
    }
    const documents = [...groups.entries()].map(([documentId,versions])=>{
      const published=this.currentVersions.get(documentId);
      if(!published && versions.length!==1)throw new BoardError('CURRENT_DOCUMENT_VERSION_REQUIRED');
      return published?this.versions.get(published)!:versions[0]!;
    }).sort((a,b)=>a.document_version_id.localeCompare(b.document_version_id));
    const digest = hash({scope:scopedIdentity, documents});
    return frozenCopy({ snapshot_id: digest, ...scopedIdentity, documents, hash: digest });
  }
  documents(actor: AccessContext, scope: Scope, snapshot: EvidenceSnapshot): LegalDocument[] {
    assertAccess(actor,scope);
    if (snapshot.study_id!==scope.study_id || snapshot.matter_id!==scope.matter_id || snapshot.snapshot_id!==snapshot.hash || snapshot.hash!==hash({scope:{study_id:scope.study_id,matter_id:scope.matter_id},documents:snapshot.documents})) throw new BoardError('SNAPSHOT_SCOPE_OR_HASH_INVALID');
    if (snapshot.documents.some(d=>d.source_type==='PRIVATE_MATTER' && (d.study_id!==scope.study_id || d.matter_id!==scope.matter_id))) throw new BoardError('ACCESS_DENIED');
    if (snapshot.documents.some(d=>hash(this.versions.get(d.document_version_id)??null)!==hash(d)))throw new BoardError('SNAPSHOT_NOT_REGISTERED');
    return structuredClone(snapshot.documents);
  }
  async search(actor: AccessContext, request: LegalResearchRequest, snapshot: EvidenceSnapshot, limit: number): Promise<Passage[]> {
    const docs = this.documents(actor,request,snapshot);
    if (request.matter_snapshot_id!==snapshot.snapshot_id || request.corpus_snapshot_id!==snapshot.snapshot_id) throw new BoardError('SNAPSHOT_VERSION_MISMATCH');
    for (const selected of request.selected_document_ids) if (!docs.some(d=>d.document_id===selected)) throw new BoardError('DOCUMENT_NOT_AUTHORIZED_OR_NOT_IN_SNAPSHOT');
    const scoped = docs.filter(d=>request.selected_document_ids.includes(d.document_id) && d.metadata.jurisdiction===request.jurisdiction && (!d.metadata.date || d.metadata.date<=request.as_of_date));
    const passages = scoped.flatMap(passagesOf);
    const words = new Set(request.legal_question.toLocaleLowerCase('es').match(/[\p{L}\p{N}]{4,}/gu) ?? []);
    const score = (p: Passage) => [...words].filter(w=>p.text.toLocaleLowerCase('es').includes(w)).length;
    let ranked = [...passages].sort((a,b)=>score(b)-score(a) || a.passage_id.localeCompare(b.passage_id));
    if (this.semantic) {
      const rankedIds = await this.semantic.search(request.legal_question,frozenCopy(passages),limit);
      if (rankedIds.some(id=>!passages.some(p=>p.passage_id===id))) throw new BoardError('SEMANTIC_ADAPTER_SCOPE_VIOLATION');
      ranked = [...ranked].sort((a,b)=>(rankedIds.includes(a.passage_id)?0:1)-(rankedIds.includes(b.passage_id)?0:1));
    }
    return ranked.slice(0,limit);
  }
  byMetadata(actor: AccessContext, scope: Scope, snapshot: EvidenceSnapshot, metadata: Partial<LegalDocument['metadata']>): LegalDocument[] {
    return this.documents(actor,scope,snapshot).filter(d=>Object.entries(metadata).every(([k,v])=>d.metadata[k as keyof typeof d.metadata]===v));
  }
  passage(actor: AccessContext, scope: Scope, snapshot: EvidenceSnapshot, documentId: string, passageId: string): Passage {
    const doc = this.documents(actor,scope,snapshot).find(d=>d.document_id===documentId && d.text_spans.some(p=>p.passage_id===passageId));
    if (!doc) throw new BoardError('PASSAGE_NOT_AUTHORIZED_OR_NOT_FOUND');
    return passagesOf(doc).find(p=>p.passage_id===passageId)!;
  }
}
export class ExactCitationResolver implements CitationResolver {
  resolve(citation: Citation, documents: readonly LegalDocument[]): LegalDocument[] {
    const eligible = documents.filter(d=>d.source_type===citation.source_type && d.metadata.jurisdiction===citation.jurisdiction);
    if (citation.source_id) return eligible.filter(d=>d.document_id===citation.source_id);
    if (citation.official_id) return eligible.filter(d=>d.metadata.official_id===citation.official_id);
    // Candidate discovery by number only is deliberately followed by full identity checking.
    return eligible.filter(d=>citation.number!==null && d.metadata.number===citation.number);
  }
}
