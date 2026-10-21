import { useId, useState } from "react";
import { specialistCatalog } from "./specialist-catalog.js";

export default function SpecialistStudio() {
  const sectionId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = specialistCatalog.find((specialist) => specialist.id === selectedId);

  return (
    <section className="specialist-studio" aria-labelledby={sectionId + "-title"}>
      <header className="studio-heading">
        <div>
          <span className="eyebrow">ESTUDIO JURÍDICO · EQUIPO IA</span>
          <h2 id={sectionId + "-title"}>Seis áreas. Más perspectiva.</h2>
        </div>
        <span className="studio-catalog-label">Catálogo de especialistas</span>
      </header>
      <div className="specialist-lineup" aria-label="Explorar áreas de práctica">
        {specialistCatalog.map((specialist) => (
          <button
            key={specialist.id}
            className="specialist-persona"
            aria-expanded={selectedId === specialist.id}
            aria-controls={sectionId + "-detail"}
            onClick={() => setSelectedId(selectedId === specialist.id ? null : specialist.id)}
          >
            <img
              src={"/agents/" + specialist.id + ".png"}
              alt=""
              width={144}
              height={144}
              decoding="async"
            />
            <strong>{specialist.name}</strong>
            <span>{specialist.area}</span>
          </button>
        ))}
      </div>
      <div id={sectionId + "-detail"} hidden={!selected} className="specialist-detail">
        {selected && (
          <>
            <div className="specialist-detail-heading">
              <h3>{selected.name} <span>· {selected.area}</span></h3>
              <button onClick={() => setSelectedId(null)} aria-label="Cerrar detalle del especialista">Cerrar</button>
            </div>
            <p>{selected.description}</p>
            <ul>{selected.subareas.map((subarea) => <li key={subarea}>{subarea}</li>)}</ul>
          </>
        )}
      </div>
      <footer className="studio-caption">
        <span>Elegí un personaje para explorar su área.</span>
        <span>Convocatoria por asunto pendiente de habilitación.</span>
      </footer>
    </section>
  );
}
