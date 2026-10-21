import type { LegalTeamProps } from "./LegalTeam.js";
import { lazy, Suspense, useState } from "react";
import AnalysisLevelPicker from "./AnalysisLevelPicker.js";
import { queueGabrielRequest } from "./gabriel-request.js";
const LegalTeam = lazy(() => import("./LegalTeam.js"));
const MatterJunta = lazy(() => import("./MatterJunta.js"));
const ContractualPilot = lazy(() => import("./ContractualPilot.js"));

/** All new legal work enters Gabriel's controlled document runtime. */
export default function LegalWorkspace(
  props: LegalTeamProps & { onOpenWorkspace: (draftId?: string) => void },
) {
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState(props.drafts[0]?.id ?? "");
  const [archive, setArchive] = useState(false);
  return (
    <>
      <section
        className="unified-consultation"
        aria-label="Consulta jurídica del asunto"
      >
        <div>
          <span className="eyebrow">{props.matter.title}</span>
          <h2>Trabajá con Gabriel</h2>
        </div>
        <p>
          Un mismo recorrido: especialistas elegidos por Gabriel, integración,
          auditor independiente, control de citas y correcciones. Elegí la
          potencia para este pedido.
        </p>
        <AnalysisLevelPicker />
        <label>
          Documento de trabajo
          <select value={draft} onChange={(e) => setDraft(e.target.value)}>
            <option value="">
              Documento nuevo / consulta sin documento previo
            </option>
            {props.drafts.map((item) => (
              <option key={item.id} value={item.id}>
                {props.documents.find((doc) => doc.id === item.document_id)
                  ?.title ?? "Documento de trabajo"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tu pedido
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Contale el caso, pedí un análisis o continuá un trabajo anterior…"
          />
        </label>
        <div className="unified-consultation-actions">
          <button
            className="primary"
            onClick={() => {
              if (instruction.trim())
                queueGabrielRequest(
                  props.matter.id,
                  props.actorId,
                  instruction,
                );
              props.onOpenWorkspace(draft || undefined);
            }}
          >
            Continuar con Gabriel →
          </button>
          <small>
            Revisá el documento y enviá el pedido desde el workspace · hasta USD
            0,60.
          </small>
        </div>
        <button aria-expanded={archive} onClick={() => setArchive(!archive)}>
          Informes anteriores conservados {archive ? "▴" : "▾"}
        </button>
      </section>
      {archive && (
        <section aria-label="Archivo de consultas anteriores">
          <p>
            Archivo histórico. Los nuevos encargos se realizan con Gabriel y el
            nivel elegido.
          </p>
          <Suspense
            fallback={<p role="status">Abriendo informes conservados…</p>}
          >
            <LegalTeam {...props} archiveOnly />
            <MatterJunta {...props} archiveOnly />
            <ContractualPilot {...props} archiveOnly />
          </Suspense>
        </section>
      )}
    </>
  );
}
