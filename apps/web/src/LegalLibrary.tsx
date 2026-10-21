import { useState } from "react";
import LibraryDocuments from './LibraryDocuments.js';
import catalog from "../../../docs/fuentes/FUENTES_Y_APIS_PARAGUAY_v1.1.json" with { type: "json" };

type Category =
  | "Constitución"
  | "Leyes y decretos"
  | "Códigos"
  | "Jurisprudencia"
  | "Datos y APIs";
const groups: Record<string, Category> = {
  "PY-CONSTITUCION": "Constitución",
  "PY-BACN": "Leyes y decretos",
  "PY-CSJ-LEG": "Leyes y decretos",
  "PY-GACETA": "Leyes y decretos",
  "PY-DIGESTO-NORM": "Leyes y decretos",
  "PY-CPP-IIJ": "Códigos",
  "PY-CP-IIJ": "Códigos",
  "PY-CC-CONATEL": "Códigos",
  "PY-CPC-CORREO": "Códigos",
  "PY-CSJ-JUR": "Jurisprudencia",
  "PY-CSJ-RESWEB": "Jurisprudencia",
  "PY-DIGESTO-JUR": "Jurisprudencia",
  "PY-CONG-V2": "Datos y APIs",
  "PY-CONG-V1": "Datos y APIs",
  "PY-CSJ-OPEN": "Datos y APIs",
};
const checks: Record<string, string> = {
  "PY-CSJ-JUR": "Portal observado · 13/10/2026",
  "PY-CSJ-LEG": "Portal observado · 13/10/2026",
  "PY-CONSTITUCION": "Página observada · 13/10/2026",
  "PY-CONG-V2": "Página observada · 13/10/2026",
  "PY-BACN": "Revisión automática: HTTP 403 · 13/10/2026",
  "PY-GACETA": "Revisión automática: timeout · 13/10/2026",
};
const categories: Category[] = [
  "Constitución",
  "Leyes y decretos",
  "Códigos",
  "Jurisprudencia",
  "Datos y APIs",
];
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PY");
export default function LegalLibrary() {
  const [view,setView]=useState('Documentos');
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("Todas");
  const sources = catalog.sources.filter(
    (source) =>
      (category === "Todas" || groups[source.id] === category) &&
      normalize(
        [
          source.name,
          source.institution,
          source.scope,
          source.url,
          groups[source.id],
        ].join(" "),
      ).includes(normalize(search)),
  );
  return (
    <section
      className="data-panel legal-library"
      aria-labelledby="library-heading"
    >
      <div className="actions" role="group" aria-label="Vistas de biblioteca">
        <button aria-pressed={view==='Documentos'} onClick={()=>setView('Documentos')}>Documentos</button>
        <button aria-pressed={view==='Fuentes'} onClick={()=>setView('Fuentes')}>Fuentes y buscadores oficiales</button>
      </div>
      {view==='Documentos'?<LibraryDocuments />:<>
      <div className="list-toolbar">
        <h2 id="library-heading">Fuentes jurídicas de Paraguay</h2>
        <label className="search">
          <span className="sr-only">Buscar fuente jurídica</span>
          <input
            aria-label="Buscar fuente jurídica"
            placeholder="Constitución, decretos, civil, sala…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Categoría de fuente</span>
          <select
            aria-label="Categoría de fuente"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Todas</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="panel-note">
        Accesos a portales y publicaciones estatales. Los enlaces se abren en
        otra pestaña. La búsqueda filtra este directorio; buscá leyes o fallos
        dentro de cada portal.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fuente / institución</th>
              <th>Categoría y alcance</th>
              <th>Acceso y revisión</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.name} ↗
                  </a>
                  <div className="muted">{source.institution}</div>
                </td>
                <td>
                  <span className="badge">{groups[source.id]}</span>
                  <p className="source-scope">{source.scope}</p>
                </td>
                <td>
                  <div className="muted">
                    {checks[source.id] ??
                      `Registrada: ${source.checked_on} · no revalidada en esta revisión`}
                  </div>
                  <details>
                    <summary>Observaciones</summary>
                    <p>{source.coverage}</p>
                    <p>{source.license}</p>
                    {source.id === "PY-CPC-CORREO" && (
                      <p>
                        Documento candidato: apertura y contenido pendientes de
                        comprobar.
                      </p>
                    )}
                    {source.id === "PY-CONG-V1" && (
                      <p>Ruta histórica; preferir el portal legislativo v2.</p>
                    )}
                    <p>
                      Vigencia y modificatorias deben comprobarse en cada
                      consulta.
                    </p>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!sources.length && (
        <p className="empty">No hay fuentes que coincidan con estos filtros.</p>
      )}
      <footer className="panel-footer">
        <span>
          {sources.length} de {catalog.sources.length} fuentes registradas
        </span>
        <span>
          Directorio de enlaces · indexación y verificación de citas pendientes
        </span>
      </footer>
      </>}
    </section>
  );
}
