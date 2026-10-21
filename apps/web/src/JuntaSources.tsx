import {sourceLink,sourceUse,sourceLocation,sourceExcerptLink,sourceReadingWarning,type LibraryResearch} from './junta-sources.js';
export default function JuntaSources({research,title='Fuentes de la consulta',onOpenSource}:{research?:LibraryResearch;title?:string;onOpenSource?:(id:string)=>void}){
  if(!research)return <p className="panel-note">Esta consulta guardada se realizó antes de conectar la Biblioteca. Una nueva consulta incorporará la búsqueda de fuentes.</p>;
  return <section className="junta-sources" aria-labelledby="junta-sources-title">
    <header><h3 id="junta-sources-title">{title}</h3><p>Leyes, decretos y jurisprudencia buscados en la Biblioteca · {research.sources.length} publicaciones con fragmentos seleccionados.</p></header>
    {research.sources.map(s=><details key={s.source_id} className="research-source" open={s.use==='CITED'}>
      <summary><span className="badge">{s.document_type??(s.kind==='OFFICIAL_CASELAW'?'Jurisprudencia':'Legislación')}</span><strong>{s.title}</strong><span className="muted">{sourceUse(s.use)}</span></summary>
      <p>{s.publisher} · {s.publication_kind}</p>
      {onOpenSource&&<button onClick={()=>onOpenSource(s.source_id)}>Leer publicación en el OS</button>}
      {sourceReadingWarning(s)&&<p className={s.extraction_status==='PARTIAL_TEXT_UNREVIEWED'?'error':'panel-note'}>{sourceReadingWarning(s)}</p>}
      {s.normative_status&&s.normative_status!=='NO DEROGADO'&&<p className="error">Estado informado por el portal: {s.normative_status.toLowerCase()}. Revisar alcance temporal antes de utilizar.</p>}
      {sourceLink(s.url)&&<a href={sourceLink(s.url)!} target="_blank" rel="noopener noreferrer">Abrir publicación oficial ↗</a>}
      {s.excerpts.map(e=><div key={e.passage_id} className="research-excerpt"><p><strong>{sourceLocation(s,e)}</strong>{' · '}<a href={sourceExcerptLink(s,e)??undefined} target="_blank" rel="noopener noreferrer">Abrir texto oficial ↗</a></p><blockquote>{e.text}</blockquote></div>)}
      {s.citations?.map((c,i)=><p key={i}><strong>Cita del informe.</strong> {c.reference}{c.quote&&<> «{c.quote}» · {c.quote_match?'El texto coincide con el fragmento recuperado.':'El texto no pudo cotejarse con el fragmento: revisar antes de usar.'}</>}</p>)}
      <p className="muted">Texto extraído de la publicación. La selección por palabras clave no acredita aplicabilidad, vigencia ni autenticidad de una sentencia individual.</p>
    </details>)}
    {!research.sources.length&&<p>No se encontró texto pertinente en el conjunto disponible.</p>}
    {!!research.located.length&&<details><summary>Referencias adicionales localizadas · texto no consultado ({research.located.length})</summary><p>No se entregaron como fundamento al abogado principal.</p><ul>{research.located.map(s=><li key={s.source_id}>{sourceLink(s.url)?<a href={sourceLink(s.url)!} target="_blank" rel="noopener noreferrer">{s.title} ↗</a>:s.title}</li>)}</ul></details>}
    <details><summary>Alcance de la búsqueda</summary><p>{research.indexed_sources} publicaciones con texto y {research.catalog_records.toLocaleString('es-PY')} referencias en el catálogo. Fecha de la consulta: {research.as_of_date}. No es una búsqueda exhaustiva de todo el derecho paraguayo.</p><ul>{research.limitations.map((v,i)=><li key={i}>{v}</li>)}</ul></details>
  </section>;
}
