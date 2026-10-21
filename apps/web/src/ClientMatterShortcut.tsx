import { useRef, useState } from "react";
import type { Client, Matter } from "../../../os-core/src/contracts.js";
import { api } from "./api.js";
import { TeamConfigSchema, type TeamConfig } from "./specialist-engine.js";
import type { TeamView } from "./local-team.js";
import { asuncionDate } from "./local-dates.js";

const areas = {
  elena: "Contratos",
  valeria: "Civil y comercial",
  lucia: "Laboral",
  martin: "Tributario",
  diego: "Penal",
  camila: "Administrativo",
};
export default function ClientMatterShortcut({
  firmId,
  actorId,
  clients,
  matters,
  config,
  onOpen,
  onBusy,
  initialClientId = "",
  initialMatterId = "",
}: {
  firmId: string;
  actorId: string;
  clients: Client[];
  matters: Matter[];
  config: TeamConfig;
  onOpen: (matter: Matter, tab: string) => void;
  onBusy: (busy: boolean) => void;
  initialClientId?: string;
  initialMatterId?: string;
}) {
  const [clientChoice, setClientChoice] = useState(
      clients.some((c) => c.id === initialClientId) ? initialClientId : "",
    ),
    [matterChoice, setMatterChoice] = useState(
      matters.some(
        (m) => m.id === initialMatterId && m.client_id === initialClientId,
      )
        ? initialMatterId
        : "",
    );
  const [clientName, setClientName] = useState(""),
    [clientKind, setClientKind] = useState<"PERSON" | "ORGANIZATION">(
      "ORGANIZATION",
    ),
    [identification, setIdentification] = useState("");
  const [title, setTitle] = useState(config.question.slice(0, 160)),
    [kind, setKind] = useState(
      config.lead_id === "elena" ? "CONTRACTUAL" : "ADVISORY",
    ),
    [area, setArea] = useState(areas[config.lead_id]);
  const [synthetic, setSynthetic] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{ signature: string; payload: unknown } | null>(null);
  const client = clients.find((c) => c.id === clientChoice),
    matter = matters.find(
      (m) => m.id === matterChoice && m.client_id === clientChoice,
    );
  const newClient = clientChoice === "NEW",
    newMatter = matterChoice === "NEW";
  const valid =
    (newClient ? Boolean(clientName.trim()) : Boolean(client)) &&
    (newMatter ? Boolean(title.trim()) : Boolean(matter));
  function chooseClient(value: string) {
    setClientChoice(value);
    setMatterChoice(value === "NEW" ? "NEW" : "");
    setError("");
  }
  async function confirm() {
    if (busy || !valid || !synthetic) return;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const team = TeamConfigSchema.parse(config);
      const context = {
        config: team,
        client: newClient
          ? {
              mode: "NEW",
              input: {
                kind: clientKind,
                display_name: clientName.trim(),
                identification: identification.trim() || null,
              },
            }
          : { mode: "EXISTING", client_id: clientChoice },
        matter: newMatter
          ? {
              mode: "NEW",
              input: {
                title: title.trim(),
                kind,
                subject_area: area,
                responsible_identity_id: actorId,
                opened_on: asuncionDate(),
                closed_on: null,
              },
            }
          : { mode: "EXISTING", matter_id: matterChoice },
      };
      const signature = JSON.stringify(context);
      if (pending.current?.signature !== signature) {
        const state = !newMatter
          ? await api<TeamView>(
              `/firms/${firmId}/matters/${matterChoice}/legal-team`,
            )
          : null;
        pending.current = {
          signature,
          payload: {
            ...context,
            command_id: crypto.randomUUID(),
            expected_version: state?.assignment_version ?? 0,
            synthetic_data: true,
            max_cost_usd: 0,
          },
        };
      }
      const result = await api<{ matter: Matter }>(
        `/firms/${firmId}/director/context`,
        pending.current.payload,
      );
      sessionStorage.removeItem(
        "law-order.director.intake." + firmId + "." + actorId,
      );
      onOpen(result.matter, "junta");
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      setError(
        code === "TEAM_CLIENT_MISMATCH"
          ? "El asunto debe pertenecer al cliente elegido."
          : code === "TEAM_ASSIGNMENT_CONFLICT"
            ? "Cambió el equipo del asunto. Revisá la asignación antes de continuar."
            : "No se pudo confirmar el contexto. Se conservan tu pregunta y los campos; revisá los datos y permisos.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section
      className="client-matter-shortcut"
      aria-label="Cliente y asunto del encargo"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">ANTES DE CONTINUAR</span>
          <h3>¿Para qué cliente y asunto trabajamos?</h3>
        </div>
        <span className="shortcut-tag">Atajo de apertura</span>
      </div>
      <p className="muted">
        Tu consulta y la propuesta se conservan. Elegí el contexto o crealo acá;
        los documentos y resultados quedarán dentro de ese asunto.
      </p>
      <div className="shortcut-context-grid">
        <fieldset disabled={busy}>
          <legend>
            <span>1</span> Cliente
          </legend>
          <label>
            Cliente del encargo
            <select
              aria-label="Cliente del encargo"
              value={clientChoice}
              onChange={(e) => chooseClient(e.target.value)}
            >
              <option value="">Elegí un cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
              <option value="NEW">+ Crear cliente nuevo</option>
            </select>
          </label>
          <button
            type="button"
            className="text-action"
            onClick={() => chooseClient("NEW")}
          >
            Nuevo cliente aquí
          </button>
          {newClient && (
            <div className="shortcut-new-fields">
              <label>
                Tipo de cliente
                <select
                  aria-label="Tipo del cliente nuevo"
                  value={clientKind}
                  onChange={(e) =>
                    setClientKind(e.target.value as typeof clientKind)
                  }
                >
                  <option value="ORGANIZATION">Organización</option>
                  <option value="PERSON">Persona</option>
                </select>
              </label>
              <label>
                Nombre del cliente
                <input
                  aria-label="Nombre del cliente nuevo"
                  maxLength={240}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </label>
              <label>
                Identificación (opcional)
                <input
                  aria-label="Identificación del cliente nuevo"
                  maxLength={100}
                  value={identification}
                  onChange={(e) => setIdentification(e.target.value)}
                />
              </label>
            </div>
          )}
          {client && (
            <div className="context-selection">
              <strong>{client.display_name}</strong>
              <small>
                {client.kind === "ORGANIZATION" ? "Organización" : "Persona"}
                {client.identification ? " · " + client.identification : ""}
              </small>
            </div>
          )}
        </fieldset>
        <fieldset disabled={busy || !clientChoice}>
          <legend>
            <span>2</span> Asunto / caso
          </legend>
          <label>
            Asunto del encargo
            <select
              aria-label="Asunto del encargo"
              disabled={newClient}
              value={matterChoice}
              onChange={(e) => {
                setMatterChoice(e.target.value);
                setError("");
              }}
            >
              <option value="">Elegí un asunto de este cliente</option>
              {matters
                .filter((m) => m.client_id === clientChoice)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              <option value="NEW">+ Crear asunto nuevo</option>
            </select>
          </label>
          <button
            className="text-action"
            type="button"
            onClick={() => setMatterChoice("NEW")}
          >
            Nuevo asunto aquí
          </button>
          {newMatter && (
            <div className="shortcut-new-fields">
              <label>
                Título del asunto
                <input
                  aria-label="Título del encargo"
                  maxLength={240}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <div className="shortcut-field-pair">
                <label>
                  Tipo
                  <select
                    aria-label="Tipo del asunto nuevo"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="ADVISORY">Consultivo</option>
                    <option value="CONTRACTUAL">Contractual</option>
                    <option value="JUDICIAL">Litigioso</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </label>
                <label>
                  Área
                  <select
                    aria-label="Área del asunto nuevo"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    {[
                      "Contratos",
                      "Civil y comercial",
                      "Laboral",
                      "Penal",
                      "Familia",
                      "Administrativo",
                      "Tributario",
                      "Constitucional",
                      "Otra",
                    ].map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
              </div>
              <small>
                Responsable: tu perfil actual. Se registra como un asunto del
                cliente.
              </small>
            </div>
          )}
          {matter && (
            <div className="context-selection">
              <strong>{matter.title}</strong>
              <small>
                {client?.display_name} · {matter.subject_area}
              </small>
            </div>
          )}
        </fieldset>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {valid && (
        <p className="context-save-note">
          {newClient
            ? `Al confirmar se crearán el cliente «${clientName.trim()}» y el asunto «${title.trim()}».`
            : newMatter
              ? `Al confirmar se creará «${title.trim()}» dentro de ${client?.display_name}.`
              : `La consulta quedará dentro de ${client?.display_name} → ${matter?.title}.`}
        </p>
      )}
      <div className="shortcut-confirm">
        <label className="synthetic-consent">
          <input
            type="checkbox"
            checked={synthetic}
            disabled={busy}
            onChange={(e) => setSynthetic(e.target.checked)}
          />
          Confirmo que el encargo contiene datos sintéticos.
        </label>
        <button
          className="primary"
          disabled={busy || !synthetic || !valid}
          onClick={confirm}
        >
          {busy ? "Abriendo contexto…" : "Confirmar equipo y abrir asunto"}
        </button>
      </div>
    </section>
  );
}
