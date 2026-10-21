import { PacketSchema, type LegalCasePacket } from '../domain/contracts.js';
import { BoardError, frozenCopy, validateProvenance } from '../domain/guards.js';
import type { ContextInput, LunaProvider } from '../providers/contracts.js';
import type { StageCaller } from '../evidence-router/index.js';

export async function buildContext(input:ContextInput,provider:LunaProvider,call:StageCaller):Promise<LegalCasePacket>{
  const packet=PacketSchema.parse((await call('BUILDING_CONTEXT',provider,input)).output);
  if(packet.request_id!==input.request.request_id || packet.study_id!==input.request.study_id || packet.matter_id!==input.request.matter_id || packet.matter_snapshot_id!==input.request.matter_snapshot_id || packet.packet_version!==(input.previous_packet?.packet_version??0)+1)throw new BoardError('PACKET_ID_OR_VERSION_MISMATCH');
  if(packet.documentary_facts.some(f=>f.kind!=='DOCUMENT_CONTENT') || packet.party_allegations.some(f=>f.kind!=='PARTY_ALLEGATION'))throw new BoardError('FACT_CATEGORY_INVALID');
  validateProvenance([...packet.documentary_facts,...packet.party_allegations,...packet.chronology,...packet.contested_facts,...packet.contradictions],input.passages);
  if(packet.relevant_documents.some(id=>!input.passages.some(p=>p.document_id===id)))throw new BoardError('PACKET_UNKNOWN_DOCUMENT');
  packet.coverage_limitations=[...new Set([...packet.coverage_limitations,...input.evidence.coverage.limitations,...(input.evidence.coverage.uncertain_passage_ids.length?['Hay fragmentos inciertos pendientes de revisión.']:[])])];
  return frozenCopy(packet);
}
