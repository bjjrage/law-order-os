import type { Result } from './MatterJunta.js';
import { legalSections } from './junta-presentation.js';
import { lawyerText } from './junta-lawyer-language.js';
import JuntaReviewChecks from './JuntaReviewChecks.js';
import JuntaSources from './JuntaSources.js';
export default function JuntaLegalDocument({result}:{result:Result}){
  const analysis=result.analysis;
  if(!analysis)return null;
  const parts=legalSections(analysis.legal_analysis);
  return <article className="legal-opinion" aria-labelledby="legal-opinion-title">
    <header className="legal-opinion-header"><span className="eyebrow">INFORME JURÍDICO · {result.mode==='LIVE'?'BORRADOR':'SIMULACIÓN'}</span><h2 id="legal-opinion-title">Revisión de la consulta</h2><p>{result.question}</p><span className="opinion-status">Revisión humana pendiente</span></header>
    <JuntaReviewChecks result={result}/>
    {parts.map((p,i)=>p.kind==='section'?<section key={i} className="opinion-section"><h3><span>{p.number.padStart(2,'0')}</span>{p.title}</h3><p>{p.text}</p></section>:<section key={i} className={p.kind==='lead'?'opinion-lead':p.kind==='conclusion'?'opinion-conclusion':'opinion-section'}>{p.kind==='lead'&&<h3>Criterio de revisión</h3>}{p.kind==='conclusion'&&<h3>Conclusión y alcance</h3>}<p>{p.text}</p></section>)}
    {!!result.audit?.findings.length&&<section className="opinion-audit"><h3>Observaciones del auditor adversarial</h3>{result.audit.findings.map((f,i)=><details key={i} open={f.severity==='HIGH'||f.severity==='CRITICAL'}><summary><span className={`severity severity-${f.severity??'MEDIUM'}`}>{f.severity==='CRITICAL'?'Crítica':f.severity==='HIGH'?'Alta':f.severity==='LOW'?'Baja':'Media'}</span>{lawyerText(f.statement)}</summary><p><strong>Acción recomendada.</strong> {lawyerText(f.recommended_action)}</p></details>)}</section>}
    {!!analysis.unresolved_issues.length&&<details className="opinion-more"><summary>Documentación y cuestiones pendientes ({analysis.unresolved_issues.length})</summary><ul>{analysis.unresolved_issues.map((v,i)=><li key={i}>{lawyerText(v)}</li>)}</ul></details>}
    {!!analysis.alternative_interpretations?.length&&<details className="opinion-more"><summary>Interpretaciones alternativas</summary><ul>{analysis.alternative_interpretations.map((v,i)=><li key={i}>{lawyerText(v)}</li>)}</ul></details>}
    <JuntaSources research={result.library_research}/>
    <details className="opinion-more"><summary>Alcance y limitaciones</summary><ul>{analysis.limitations.map((v,i)=><li key={i}>{lawyerText(v)}</li>)}</ul><p>La comprobación de fuentes se limita a los documentos disponibles y no equivale a aprobación jurídica.</p></details>
    <footer>El contenido conserva el análisis y las observaciones originales. La presentación no añade conclusiones ni acredita hechos.</footer>
  </article>;
}
