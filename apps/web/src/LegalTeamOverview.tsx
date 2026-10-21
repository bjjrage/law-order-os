import { useState } from "react";
import { Avatar } from "./TeamEditor.js";
import { loadPack, personas, primaryPacks } from "./specialist-engine.js";
import "./legal-team-overview.css";

const missions: Record<string, { task: string; deliverable: string }> = {
  elena: {
    task: "Revisa obligaciones, condiciones y riesgos patrimoniales. Identifica contradicciones y anexos que faltan.",
    deliverable: "Puntos contractuales a resolver y condiciones pendientes.",
  },
  valeria: {
    task: "Examina actos societarios, representación y facultades. Ordena los respaldos de las decisiones empresariales.",
    deliverable: "Actos, facultades y aprobaciones que deben acreditarse.",
  },
  lucia: {
    task: "Ordena la relación laboral, su cronología y las posiciones de las partes, distinguiendo alegaciones de documentos.",
    deliverable: "Cronología, hechos discutidos y documentación faltante.",
  },
  martin: {
    task: "Relaciona operaciones, períodos y obligaciones tributarias. Identifica los comprobantes necesarios para revisar el tratamiento.",
    deliverable: "Obligaciones y respaldos por operación y período.",
  },
  diego: {
    task: "Separa hipótesis penales y elementos probatorios. Considera evidencia favorable, evidencia contraria y garantías.",
    deliverable: "Hipótesis, límites probatorios y puntos de defensa.",
  },
  camila: {
    task: "Examina competencia, actos administrativos y procedimiento. Revisa fundamentos y constancias de notificación.",
    deliverable: "Secuencia del procedimiento y requisitos pendientes.",
  },
};
const stages = [
  {
    name: "Delimitar",
    who: "Gabriel",
    short: "Define el pedido y propone el equipo.",
    title: "Una pregunta concreta para cada integrante",
    detail:
      "Gabriel aclara qué querés resolver, propone un titular y convoca las especialidades pertinentes. El humano elige Ágil, Medio o Profundo; Gabriel elige el equipo según el pedido.",
    output: "Encargo, responsable y cuestiones asignadas.",
  },
  {
    name: "Analizar",
    who: "Especialistas convocados",
    short: "Trabajan sobre el mismo material.",
    title: "Aportes independientes, con respaldo",
    detail:
      "Cada especialista examina su cuestión. Distingue texto documental, alegaciones, inferencias y datos desconocidos; señala alternativas y evidencia faltante.",
    output: "Hallazgos por especialidad, con sus límites.",
  },
  {
    name: "Contrastar",
    who: "Santiago · en los tres niveles",
    short: "Objeta; los especialistas responden.",
    title: "Los desacuerdos se hacen visibles",
    detail:
      "Santiago revisa los aportes y la integración con un modelo distinto del analista. Los especialistas corrigen los errores detectados y se vuelve a auditar y controlar. Los pendientes se conservan para revisión humana.",
    output: "Puntos conflictivos y estado de sus respuestas.",
  },
  {
    name: "Integrar",
    who: "Especialista titular",
    short: "Se hace cargo del entregable.",
    title: "Alguien reúne el trabajo y entrega un resultado",
    detail:
      "El titular integra los aportes, indica reservas y mantiene los desacuerdos relevantes. La discusión queda como respaldo; el documento concentra el resultado y las próximas acciones.",
    output: "Documento integrado, conflictos y pendientes.",
  },
  {
    name: "Controlar",
    who: "Control de referencias",
    short: "Revisa citas y su trazabilidad.",
    title: "Una cita no se valida por parecer convincente",
    detail:
      "El control identifica referencias y coteja su respaldo dentro de la cobertura disponible. Una fuente no recuperada o no cotejada queda pendiente. Esto no certifica por sí solo la interpretación jurídica.",
    output: "Estado de fuentes, observaciones y límites del control.",
  },
  {
    name: "Aprobar",
    who: "Profesional humano responsable",
    short: "Revisa, pide cambios o aprueba.",
    title: "La decisión final tiene responsable humano",
    detail:
      "El profesional evalúa el criterio jurídico y las fuentes, resuelve los puntos pendientes y decide sobre una versión concreta del borrador.",
    output: "Revisión humana registrada sobre el entregable.",
  },
];

export default function LegalTeamOverview({
  onGabriel,
  onConsultation,
  inMatter = false,
}: {
  onGabriel: () => void;
  onConsultation?: () => void;
  inMatter?: boolean;
}) {
  const [stage, setStage] = useState(0);
  const active = stages[stage]!;
  return (
    <div className="studio-team-overview">
      <section className="studio-team-intro">
        <div>
          <span className="eyebrow">CONOCÉ AL ESTUDIO JURÍDICO IA</span>
          <h2>Una dirección. Seis especialidades. Una revisión crítica.</h2>
          <p>
            Gabriel recibe tu consulta. Para un análisis, convoca al equipo
            necesario y designa un titular que se hace cargo del resultado.
          </p>
        </div>
        <div className="studio-team-actions">
          <button className="primary" onClick={onGabriel}>
            Consultar a Gabriel ↗
          </button>
          {onConsultation && (
            <button onClick={onConsultation}>
              {inMatter
                ? "Ir a Consulta jurídica →"
                : "Elegir un asunto para analizar →"}
            </button>
          )}
        </div>
      </section>
      <section
        className="studio-team-leadership"
        aria-label="Dirección y revisión del estudio"
      >
        <article>
          <Avatar id="gabriel" size={76} />
          <div>
            <span className="eyebrow">DIRECCIÓN Y ASISTENCIA</span>
            <h3>Gabriel</h3>
            <p>
              Responde consultas generales, te ayuda a usar el OS y transforma
              un pedido de análisis en una propuesta de equipo.
            </p>
            <span className="studio-role-note">
              Tu puerta de entrada · voz y texto
            </span>
          </div>
        </article>
        <article>
          <Avatar id="santiago" size={76} />
          <div>
            <span className="eyebrow">REVISIÓN ADVERSARIAL</span>
            <h3>Santiago</h3>
            <p>
              Busca puntos débiles, contradicciones y evidencia contraria.
              Formula objeciones y exige respuestas a los especialistas.
            </p>
            <span className="studio-role-note">
              Auditor independiente obligatorio en Ágil, Medio y Profundo
            </span>
          </div>
        </article>
      </section>
      <section aria-labelledby="studio-specialists-heading">
        <div className="studio-section-heading">
          <div>
            <span className="eyebrow">QUIÉN SE OCUPA DE QUÉ</span>
            <h3 id="studio-specialists-heading">Los especialistas</h3>
          </div>
          <span>Se convocan según el asunto</span>
        </div>
        <div className="studio-specialists-grid">
          {personas.map((persona) => {
            const mission = missions[persona.id]!,
              primary = loadPack(persona.id, primaryPacks[persona.id]!);
            return (
              <article className="studio-specialist" key={persona.id}>
                <header>
                  <Avatar id={persona.id} size={60} />
                  <div>
                    <h4>{persona.name}</h4>
                    <span>{persona.area}</span>
                  </div>
                </header>
                <p>{mission.task}</p>
                <div className="studio-specialist-output">
                  <small>SU APORTE</small>
                  <span>{mission.deliverable}</span>
                </div>
                <details>
                  <summary>
                    Especialidades y método <span aria-hidden="true">＋</span>
                  </summary>
                  <ul className="studio-expertise-list">
                    {persona.packs.map((pack) => (
                      <li key={pack.subprofile_id}>
                        <span>{pack.label}</span>
                        <small>
                          {loadPack(persona.id, pack.subprofile_id)
                            .offline_enabled
                            ? "Herramienta local disponible"
                            : "En preparación"}
                        </small>
                      </li>
                    ))}
                  </ul>
                  <h5>Cómo examina el material</h5>
                  <ol>
                    {primary.procedure.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <p className="studio-capability-note">
                    Disponibilidad documental local. Las áreas en preparación
                    todavía no ejecutan un análisis especializado.
                  </p>
                </details>
              </article>
            );
          })}
        </div>
      </section>
      <section
        className="studio-deliberation"
        aria-labelledby="studio-deliberation-heading"
      >
        <div className="studio-section-heading">
          <div>
            <span className="eyebrow">CÓMO TRABAJA LA JUNTA</span>
            <h3 id="studio-deliberation-heading">
              Del pedido a un entregable revisado
            </h3>
          </div>
          <span>Explorá las etapas</span>
        </div>
        <div
          className="studio-deliberation-stages"
          role="group"
          aria-label="Etapas de deliberación"
        >
          {stages.map((item, i) => (
            <button
              key={item.name}
              aria-pressed={i === stage}
              onClick={() => setStage(i)}
            >
              <span className="studio-step-number">{i + 1}</span>
              <strong>{item.name}</strong>
              <small>{item.short}</small>
              <span className="studio-step-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
        <div
          className="studio-stage-detail"
          role="region"
          aria-label="Explicación de la etapa"
          aria-live="polite"
        >
          <span className="studio-stage-owner">{active.who}</span>
          <div>
            <h4>{active.title}</h4>
            <p>{active.detail}</p>
            <span>
              <strong>Qué deja:</strong> {active.output}
            </span>
          </div>
        </div>
      </section>
      <section className="studio-team-delivery">
        <div>
          <span className="eyebrow">LO QUE VAS A REVISAR</span>
          <h3>Resultado, conflictos y fuentes.</h3>
          <p>
            El trabajo del equipo se presenta para que puedas decidir sin leer
            toda la conversación entre agentes.
          </p>
        </div>
        <ul>
          <li>
            <strong>Entregable del titular</strong>
            <span>El resultado integrado y editable.</span>
          </li>
          <li>
            <strong>Puntos conflictivos</strong>
            <span>Objeciones relevantes y desacuerdos conservados.</span>
          </li>
          <li>
            <strong>Fuentes y control</strong>
            <span>Qué se cotejó, qué falta y con qué cobertura.</span>
          </li>
          <li>
            <strong>Próximas acciones</strong>
            <span>Datos faltantes y revisión humana pendiente.</span>
          </li>
        </ul>
      </section>
      <div className="studio-human-review">
        <span aria-hidden="true">✓</span>
        <p>
          <strong>La aprobación es humana.</strong> El control de referencias
          ayuda a detectar problemas de trazabilidad; el profesional responsable
          evalúa el criterio jurídico y aprueba la versión final.
        </p>
      </div>
    </div>
  );
}
