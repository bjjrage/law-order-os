import type { z } from 'zod';
import { AnalysisSchema, AuditSchema, PacketSchema, RouterOutputSchema, type FactualItem, type Passage, type ProviderResult, type Route } from '../domain/contracts.js';
import { BoardError, hash } from '../domain/guards.js';
import { DEFAULT_CONFIG, type BoardConfig } from './config.js';
import { SECURITY_INSTRUCTIONS, type AuditInput, type BoardProviders, type ContextInput, type ModelProvider, type PreparedCall, type PrincipalInput, type RouterInput } from './contracts.js';

export class OfflineProvider<I,O> implements ModelProvider<I,O> {
  readonly provider='offline-fixture';readonly simulated=true;
  constructor(readonly model_id:string,readonly schema:z.ZodType<O>,private readonly handler:(input:I)=>O|Promise<O>,readonly max_input_tokens=60000,readonly max_output_tokens=25000){}
  prepare(input:I):PreparedCall{const payload={instructions:SECURITY_INSTRUCTIONS,input};return {payload,input_token_upper_bound:Buffer.byteLength(JSON.stringify(payload))+2048,max_output_tokens:this.max_output_tokens};}
  async verifyAvailability():Promise<void>{/* Explicitly simulation; no account or network. */}
  async invoke(call:PreparedCall,signal:AbortSignal):Promise<ProviderResult<O>>{
    if(signal.aborted)throw new BoardError('CANCELLED');
    const output=this.schema.parse(await this.handler((call.payload as {input:I}).input));
    return {output,usage:{input_tokens:Math.ceil(Buffer.byteLength(JSON.stringify(call.payload))/4),output_tokens:Math.ceil(Buffer.byteLength(JSON.stringify(output))/4),reasoning_tokens_if_available:null,actual_cost_usd_if_available:0,token_count_kind:'SIMULATED'}};
  }
}
function factual(p:Passage):FactualItem{return {statement:p.text,kind:p.nature==='PARTY_ALLEGATION'?'PARTY_ALLEGATION':p.nature==='DOCUMENT_CONTENT'?'DOCUMENT_CONTENT':'MODEL_INFERENCE',references:[{source_id:p.source_id,document_id:p.document_id,document_version_id:p.document_version_id,passage_id:p.passage_id}],date:null};}
export function createOfflineProviders(config:Pick<BoardConfig,'auditor_max_input_tokens'|'auditor_max_output_tokens'>=DEFAULT_CONFIG):BoardProviders {
  return {
    jev:new OfflineProvider<RouterInput,z.infer<typeof RouterOutputSchema>>('SIMULATED_JEV_1_13',RouterOutputSchema,({request,candidates})=>({candidates:candidates.map(p=>{
      const words=request.legal_question.toLocaleLowerCase('es').match(/[\p{L}]{5,}/gu)??[];
      const related=words.some(w=>p.text.toLocaleLowerCase('es').includes(w));
      const classification:Route['classification']=p.extraction_quality!=='GOOD'||/inciert|ilegible/i.test(p.text)?'UNCERTAIN':/contradice|desconoce|no fue notificado/i.test(p.text)?'POTENTIALLY_CONTRADICTORY':related?'ESSENTIAL':'NOT_RELATED_TO_THIS_QUESTION';
      return {document_id:p.document_id,passage_id:p.passage_id,classification,relevance_score:classification==='NOT_RELATED_TO_THIS_QUESTION'?0.05:0.9,selection_reason:'SIMULACIÓN: regla lexical de fixture; no representa rendimiento de Jev.'};
    })})),
    luna:new OfflineProvider<ContextInput,z.infer<typeof PacketSchema>>('SIMULATED_LUNA',PacketSchema,input=>{
      const items=input.passages.map(factual);
      return {packet_id:`packet:${hash([input.request.request_id,input.passages]).slice(0,16)}`,packet_version:(input.previous_packet?.packet_version??0)+1,request_id:input.request.request_id,study_id:input.request.study_id,matter_id:input.request.matter_id,matter_snapshot_id:input.request.matter_snapshot_id,
        documentary_facts:items.filter(f=>f.kind==='DOCUMENT_CONTENT'),party_allegations:items.filter(f=>f.kind==='PARTY_ALLEGATION'),chronology:[],contested_facts:items.filter(f=>f.kind==='PARTY_ALLEGATION'),
        contradictions:items.filter(f=>/contradice|no fue notificado/i.test(f.statement)),relevant_documents:[...new Set(input.passages.map(p=>p.document_id))],missing_information:['Validación humana del expediente.'],unresolved_questions:['Aplicabilidad jurídica pendiente.'],coverage_limitations:['SIMULACIÓN determinística; no es respuesta de Luna.']};
    }),
    sol:new OfflineProvider<PrincipalInput,z.infer<typeof AnalysisSchema>>('SIMULATED_SOL_MEDIUM',AnalysisSchema,input=>{
      const p=input.passages.find(p=>p.source_type==='OFFICIAL_CASELAW' || p.source_type==='LEGISLATION');
      return {analysis_id:`analysis:${hash(input.request.request_id).slice(0,16)}`,request_id:input.request.request_id,question_analyzed:input.request.legal_question,factual_basis:input.packet.documentary_facts,
        legal_analysis:'BORRADOR SINTÉTICO. Se requiere evaluar la constancia documental de notificación y la alegación contraria antes de formular una conclusión jurídica.',alternative_interpretations:['La alegación y el documento pueden describir hechos distintos.'],
        supporting_references:p?[{reference_id:'ref-fixture',source_id:p.source_id,document_version_id:p.document_version_id,passage_id:p.passage_id,source_type:p.source_type as 'OFFICIAL_CASELAW'|'LEGISLATION',...p.source_metadata,quote:p.text,raw_text:null}].map(({valid_from:_from,valid_to:_to,...c})=>c):[],
        unresolved_issues:['Falta revisión por abogado.'],additional_evidence_requests:[],limitations:['SIMULACION; requiere validacion externa.'],completion_status:'NEEDS_MORE_EVIDENCE'};
    }),
    gemini:new OfflineProvider<AuditInput,z.infer<typeof AuditSchema>>('SIMULATED_GEMINI',AuditSchema,input=>{
      const suspect=input.analysis.supporting_references.filter(c=>!input.passages.some(p=>p.source_id===c.source_id && p.passage_id===c.passage_id));
      return {audit_id:`audit:${hash(input.analysis.analysis_id).slice(0,16)}`,analysis_id:input.analysis.analysis_id,
        findings:suspect.map((c,i)=>({finding_id:`suspicious:${i}`,type:'SUSPICIOUS_CITATION' as const,severity:'HIGH' as const,statement:`Referencia ${c.reference_id} sin original recuperado.`,related_source_ids:c.source_id?[c.source_id]:[],recommended_action:'Verificar en registro autorizado; no autenticar por consenso.'})),citation_objections:suspect.map(c=>c.reference_id),unsupported_fact_flags:[],missing_evidence_flags:['Revisión humana pendiente.'],requested_passages:[],audit_status:'REVIEW_REQUIRED'};
    },config.auditor_max_input_tokens,config.auditor_max_output_tokens),
  };
}
