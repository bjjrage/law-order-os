import type { Result } from './MatterJunta.js';
import { lawyerReviewSummary, lawyerText, citationObservationText } from './junta-lawyer-language.js';
export default function JuntaReviewChecks({result}:{result:Result}){
  const review=lawyerReviewSummary(result),citations=result.citation_review;
  const factCount=review.factObservations.length||result.audit?.unsupported_fact_flags?.length||0;
  const missingCount=review.missingDocuments.length||result.audit?.missing_evidence_flags?.length||0;
  return <section className="lawyer-checks" aria-labelledby="lawyer-checks-title">
    <div className="lawyer-checks-heading"><div><span className="eyebrow">CONTROL DEL INFORME</span><h3 id="lawyer-checks-title">Afirmaciones, documentos y citas</h3></div><span className="opinion-status">{review.reviewed?review.total?`${review.total} observaciones para revisar`:'Revisión recibida':'Revisión pendiente'}</span></div>
    <div className="lawyer-check-grid">
      <div className={factCount?'needs-attention':''}><h4>Respaldo de las afirmaciones</h4><strong>{!review.reviewed?'Pendiente':factCount?`${factCount} observaciones`:'Sin objeciones registradas'}</strong><p>Se cuestiona si el informe presenta como cierto lo que el expediente todavía no acredita.</p>{review.factObservations.map((f,i)=><p key={i}>{lawyerText(f.statement)}</p>)}{!review.factObservations.length&&result.audit?.unsupported_fact_flags?.map((f,i)=><p key={i}>{lawyerText(f)}</p>)}</div>
      <div className={missingCount?'needs-attention':''}><h4>Documentación decisiva</h4><strong>{!review.reviewed?'Pendiente':missingCount?`${missingCount} observaciones`:'Sin faltantes señalados por el revisor'}</strong><p>Se señala qué documentos hacen falta antes de sostener una conclusión.</p>{review.missingDocuments.map((f,i)=><p key={i}>{lawyerText(f.statement)}</p>)}{!review.missingDocuments.length&&result.audit?.missing_evidence_flags?.map((f,i)=><p key={i}>{lawyerText(f)}</p>)}</div>
      <div className={citations?.unresolved_mentions.length||citations?.observations.length?'needs-attention':''}><h4>Normas y jurisprudencia citadas</h4><strong>{!citations?.completed?'Pendiente':citations.identified_references?`${citations.verified_references} de ${citations.identified_references} referencias cotejadas`:'Sin citas completas identificadas'}</strong><p>{review.citations}</p></div>
    </div>
    {(review.referenceWarnings.length>0||citations?.unresolved_mentions.length||citations?.observations.length||result.audit?.citation_objections?.length)?<details className="opinion-more"><summary>Referencias que requieren especial cuidado</summary>{review.referenceWarnings.map((f,i)=><p key={'f'+i}>{lawyerText(f.statement)} <strong>Qué hacer:</strong> {lawyerText(f.recommended_action)}</p>)}{citations?.unresolved_mentions.map((s,i)=><p key={'m'+i}>Mención sin identificar con precisión: «{lawyerText(s)}».</p>)}{citations?.observations.map((o,i)=><p key={'o'+i}>{citationObservationText(o)}</p>)}{result.audit?.citation_objections?.map((s,i)=><p key={'a'+i}>{lawyerText(s)}</p>)}</details>:null}
    <p className="lawyer-checks-note">Estos controles ayudan a detectar posibles errores o citas inventadas. No garantizan que el informe esté libre de errores ni sustituyen la revisión del abogado responsable.</p>
  </section>;
}
