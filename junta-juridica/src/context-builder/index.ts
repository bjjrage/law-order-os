import { PacketSchema, type LegalCasePacket } from '../domain/contracts.js';
import { BoardError, frozenCopy, validateProvenance } from '../domain/guards.js';
import type { ContextInput, LunaProvider } from '../providers/contracts.js';
import type { StageCaller } from '../evidence-router/index.js';

export async function buildContext(input:ContextInput,provider:LunaProvider,call:StageCaller):Promise<LegalCasePacket>{
  const packet=PacketSchema.parse((await call('BUILDING_CONTEXT',provider,input)).output);
  if(packet.request_id!==input.request.request_id || packet.study_id!==input.request.study_id || packet.matter_id!==input.request.matter_id || packet.matter_snapshot_id!==input.request.matter_snapshot_id || packet.packet_version!==(input.previous_packet?.packet_version??0)+1)throw new BoardError('PACKET_ID_OR_VERSION_MISMATCH');
  // A general question can contain hypotheses without documentary provenance.
  // Preserve these as explicitly unproven questions, never in a factual list.
  // Documentary facts, party allegations and invented references still fail.
  if(input.request.consultation_mode==='GENERAL' && input.passages.length===0){
    for(const key of ['contested_facts','chronology','contradictions'] as const){
      const hypotheses=packet[key].filter(item=>item.kind==='MODEL_INFERENCE'&&item.references.length===0);
      packet[key]=packet[key].filter(item=>!hypotheses.includes(item));
      packet.unresolved_questions.push(...hypotheses.map(item=>`Hipótesis no acreditada propuesta por el relator, pendiente de aclaración: ${item.statement}`));
      if(hypotheses.length)packet.coverage_limitations.push(`${hypotheses.length} inferencias sin respaldo trasladadas a cuestiones pendientes; no integran hechos ni evidencia.`);
    }
  }
  // Repair redundant identifiers only when the immutable version and passage
  // locate exactly one original. Never guess a missing or foreign passage.
  const facts=[...packet.documentary_facts,...packet.party_allegations,...packet.chronology,...packet.contested_facts,...packet.contradictions];
  let repairedReferences=0;
  for(const fact of facts)for(const ref of fact.references){
    const matches=input.passages.filter(p=>p.document_version_id===ref.document_version_id && p.passage_id===ref.passage_id);
    if(matches.length===1){
      const passage=matches[0]!;
      if(ref.document_id!==passage.document_id || ref.source_id!==passage.source_id){
        ref.document_id=passage.document_id;ref.source_id=passage.source_id;repairedReferences++;
      }
    }
  }
  if(repairedReferences)packet.coverage_limitations.push(`Reparación local de ${repairedReferences} referencias: documento y fuente recuperados mediante coincidencia única exacta de versión y fragmento del original inmutable. Salida original conservada.`);
  // A claim supported only by unverified/UNKNOWN text can be retained as an
  // inference, never as documentary fact. Raw provider output remains in the
  // immutable stage artifact. Explicit party-allegation promotions still fail.
  const downgraded=packet.documentary_facts.filter(f=>f.references.length>0 && f.references.every(ref=>input.passages.some(p=>p.document_id===ref.document_id && p.document_version_id===ref.document_version_id && p.passage_id===ref.passage_id && p.source_id===ref.source_id && p.nature!=='PARTY_ALLEGATION')) && f.references.some(ref=>input.passages.some(p=>p.document_id===ref.document_id && p.passage_id===ref.passage_id && p.nature==='UNKNOWN')));
  if(downgraded.length){
    packet.documentary_facts=packet.documentary_facts.filter(f=>!downgraded.includes(f));
    packet.contested_facts.push(...downgraded.map(f=>({...f,kind:'MODEL_INFERENCE' as const,statement:`Relato no verificado: ${f.statement}`})));
    packet.coverage_limitations.push(`Clasificación conservadora local: ${downgraded.length} afirmaciones sobre texto UNKNOWN se conservaron como inferencias no verificadas, no como hechos documentados.`);
  }
  for(const fact of [...packet.chronology,...packet.contested_facts,...packet.contradictions]){
    if(fact.kind==='DOCUMENT_CONTENT' && fact.references.some(ref=>input.passages.some(p=>p.document_id===ref.document_id && p.document_version_id===ref.document_version_id && p.passage_id===ref.passage_id && p.source_id===ref.source_id && p.nature==='UNKNOWN'))){
      fact.kind='MODEL_INFERENCE';
      packet.coverage_limitations.push('Cronología y afirmaciones sobre texto UNKNOWN conservadas como inferencias no verificadas.');
    }
  }
  if(packet.documentary_facts.some(f=>f.kind!=='DOCUMENT_CONTENT') || packet.party_allegations.some(f=>f.kind!=='PARTY_ALLEGATION'))throw new BoardError('FACT_CATEGORY_INVALID');
  validateProvenance([...packet.documentary_facts,...packet.party_allegations,...packet.chronology,...packet.contested_facts,...packet.contradictions],input.passages);
  if(packet.relevant_documents.some(id=>!input.passages.some(p=>p.document_id===id)))throw new BoardError('PACKET_UNKNOWN_DOCUMENT');
  packet.coverage_limitations=[...new Set([...packet.coverage_limitations,...input.evidence.coverage.limitations,...(input.evidence.coverage.uncertain_passage_ids.length?['Hay fragmentos inciertos pendientes de revisión.']:[])])];
  return frozenCopy(packet);
}
