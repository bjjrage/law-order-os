import { z } from 'zod';
import { executePackage, personas, type TeamRun } from './specialist-engine.js';
import { hashValue, routeContractEvidence } from './contractual-pilot.js';

export const HumanScoreSchema = z.object({ pair_id: z.string(), reviewer: z.string().trim().min(2), reviewed_at: z.iso.datetime(), blind_label: z.enum(['A', 'B']), issues_detected: z.number().int().nonnegative(), critical_omissions: z.number().int().nonnegative(), grounding: z.number().min(0).max(5), incorrect_citations: z.number().int().nonnegative(), appropriate_abstention: z.number().min(0).max(5), practical_usefulness: z.number().min(0).max(5), critical_failure: z.boolean(), notes: z.string().min(10) }).strict();
/** Builds review material, never claims that a deterministic baseline establishes legal superiority. */
export async function buildOfflineComparison(run: TeamRun) {
  const lines = routeContractEvidence(run.evidence), evidenceHash = await hashValue(run.evidence);
  const blind: string[] = ['# Revisión ciega · ensayo técnico offline\nNo acredita competencia jurídica. Revisar con abogado humano y casos reservados independientes.'];
  const key: Array<{ pair_id: string; persona_id: string; specialized_label: 'A' | 'B' }> = [];
  for (const participant of run.config.participants) {
    const pairId = crypto.randomUUID(), specialized = executePackage(participant, run.evidence, run.config.depth);
    const baseline = lines.map(line => `Documento ${line.document_id}, versión ${line.version_id}, ${line.start}–${line.end} · ${line.nature}\n${line.quote}`).join('\n\n') + '\nPendiente: comprobación de hechos, versión aplicable y fuentes oficiales. Abstención de conclusión jurídica.';
    const packaged = specialized.findings.map(f => `Problema: ${f.issue}\nRespaldo: ${f.evidence.document_id}/${f.evidence.version_id} ${f.evidence.start}–${f.evidence.end} · ${f.evidence.nature}\n${f.evidence.quote}\nInterpretación: ${f.interpretation}\nAlternativa: ${f.alternative}\nPendiente: ${f.missing}`).join('\n\n') + '\n' + specialized.conclusion;
    const specializedLabel = crypto.getRandomValues(new Uint8Array(1))[0]! % 2 ? 'A' : 'B';
    key.push({ pair_id: pairId, persona_id: participant.persona_id, specialized_label: specializedLabel });
    blind.push(`## Par ${pairId}\nPregunta: ${participant.question}\nEvidencia común: ${evidenceHash}\n\n### A\n${specializedLabel === 'A' ? packaged : baseline}\n\n### B\n${specializedLabel === 'B' ? packaged : baseline}`);
  }
  return { blind_review: blind.join('\n\n'), private_key: key,
    protocol: { comparison: 'SPECIALIZATION_OFFLINE_TECHNICAL_ONLY', status: 'HUMAN_REVIEW_NOT_RUN', evaluation_release: false, evidence_hash: evidenceHash, same_evidence: true, same_tool_availability: true, same_executor: 'DETERMINISTIC_OFFLINE', budget_usd_per_arm: 0, calls_per_arm: 0, retrieval: 'EXACT_SELECTED_SNAPSHOT', baseline: 'Generic documentary inventory; access to same local tools', specialized: 'Selected package method and documentary tool', human_score_schema: HumanScoreSchema.toJSONSchema(), required_metrics: ['issues_detected', 'critical_omissions', 'grounding', 'incorrect_citations', 'appropriate_abstention', 'practical_usefulness', 'critical_failure'], release_rule: 'No automatic activation. Human-approved reserved cases, thresholds and release decision required.', system_comparison: 'Separate experiment required when retrieval, calls, resources or orchestration differ.', participants: personas.filter(p => run.config.participants.some(member => member.persona_id === p.id)).map(p => p.name) } };
}
