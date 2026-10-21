import { expect,it } from 'vitest';
import {lawyerText,lawyerError,citationExplanation,lawyerReviewSummary,citationObservationText} from '../../apps/web/src/junta-lawyer-language.js';
import {legalDocumentHtml,legalDocumentMarkdown,deliberationSteps} from '../../apps/web/src/junta-presentation.js';
it('uses legal roles and translates internal labels without upgrading unverified facts',()=>{
  expect(deliberationSteps.map(s=>s.name)).toEqual(['Documentalista','Relator','Abogado principal','Auditor adversarial','Verificador de citas']);
  const text=lawyerText('No se convirtió UNKNOWN en DOCUMENT_CONTENT. El checker requiere cotejo.');
  expect(text).toContain('No se convirtió contenido sin verificar en contenido documental');
  expect(text).not.toMatch(/UNKNOWN|DOCUMENT_CONTENT|checker/);
  expect(lawyerText('corpus delicti')).toBe('corpus delicti');
  expect(lawyerError('REFERENCE_VERIFICATION_REQUIRED')).not.toContain('REFERENCE_');
});
it('distinguishes no citations, incomplete mentions and unverified references; never certifies absence of hallucinations',()=>{
  expect(citationExplanation(undefined)).toContain('todavía');
  const base={completed:true,detected_mentions:0,identified_references:0,unresolved_mentions:[],verified_references:0,observations:[]};
  expect(citationExplanation(base)).toContain('No se identificaron citas concretas');
  expect(citationExplanation(base)).toContain('no acredita');
  expect(citationExplanation({...base,detected_mentions:2,unresolved_mentions:['Acordada','Sentencia']})).toContain('no se logró identificar una cita completa');
  expect(citationExplanation({...base,detected_mentions:2,identified_references:2,verified_references:1})).toContain('1 pudieron comprobarse');
  expect(citationObservationText({identity_status:'NOT_FOUND_IN_SCOPE',quote_status:'NOT_APPLICABLE',reason:'internal'})).toContain('puede existir en otras fuentes');
  expect(citationObservationText({identity_status:'VERIFIED_IDENTITY',quote_status:'QUOTE_MISMATCH',reason:'identity matches'})).toContain('no coincide');
});
it('retains reviewer concerns and legal qualifications in exports without model enums',()=>{
  const r={question:'Consulta ficticia',analysis:{legal_analysis:'No se acredita incumplimiento.',limitations:['El material tiene naturaleza UNKNOWN.'],unresolved_issues:[]},audit:{findings:[{type:'MISSING_EVIDENCE',statement:'Falta contrato firmado.',recommended_action:'Solicitarlo.'},{type:'UNSUPPORTED_FACT',statement:'No se acredita el pago.',recommended_action:'Cotejar comprobantes.'},{type:'SUSPICIOUS_CITATION',statement:'El pasaje 6aa78103-a2e3-4b6d-bf58-0b724543b596:p1 no es prueba.',recommended_action:'Cotejar original.'}]},cost:{estimated_total_usd:0.05}};
  expect(lawyerReviewSummary(r).total).toBe(3);expect(lawyerReviewSummary(r).factObservations).toHaveLength(1);expect(lawyerReviewSummary(r).missingDocuments).toHaveLength(1);
  for(const output of [legalDocumentHtml(r),legalDocumentMarkdown(r)]){expect(output).not.toContain('UNKNOWN');expect(output).not.toContain('6aa78103');expect(output).toContain('No se acredita el pago.');expect(output).toContain('Falta contrato firmado.');expect(output).toContain('No se acredita incumplimiento.');}
});
