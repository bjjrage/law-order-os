import { useEffect, useState } from "react";
import type { Matter } from "../../../os-core/src/contracts.js";
import type { PracticeRecord } from "../../../os-core/src/practice-model.js";
import {
  amountFromText,
  moneyDigits,
  lineTotal,
} from "../../../os-core/src/practice-model.js";
import { api } from "./api.js";
import { Form, Field } from "./components.js";
import { availableProfiles, platformRequest } from "./platform-client.js";
import { transcriptionWav } from "./session-audio.js";
import { saveBlob } from "./api.js";
import "./practice.css";

export type PracticeView = {
  approved_templates: PracticeRecord[];
  role: string;
  records: PracticeRecord[];
  events: unknown[];
  balances: {
    id: string;
    balance: number;
    received: number;
    credits: number;
    currency: string;
  }[];
  retention_days: number | null;
  template_values: Record<string, Record<string, string>>;
  versions: {
    id: string;
    matter_id: string;
    title: string;
    created_at: string;
    publishable: boolean;
  }[];
};
const labels: Record<string, string> = {
  ADMISSION: "Encargo y conflictos",
  RECORDING: "Audio de la sesion",
  TRANSCRIPT: "Transcripcion",
  MINUTES: "Acta de reunion",
  PORTAL_GRANT: "Acceso del cliente",
  PORTAL_MESSAGE: "Mensaje del cliente",
  NONE: "Sin grabacion",
  CONSENTING: "Esperando consentimiento",
  RECORDING_STATUS: "Grabando",
  STOPPED: "Grabacion detenida",
  FINALIZED: "Grabacion cerrada",
  PROPOSED: "Por revisar",
  ACCEPTED: "Aceptado",
  DECLINED: "Rechazado",
  DRAFT: "Borrador",
  APPROVED: "Aprobado",
  CANCELLED: "Cancelado",
  SUBMITTED: "Presentado",
  REJECTED: "Rechazado",
  ISSUED: "Vigente",
  VOID: "Anulado",
  RETIRED: "Retirada",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  PUBLISHED: "Publicado",
  WITHDRAWN: "Retirado",
  TIME: "Trabajo",
  EXPENSE: "Gasto",
};
export const money = (n: number, c: string) =>
  new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: c,
    maximumFractionDigits: moneyDigits(c),
  }).format(n / 10 ** moneyDigits(c));
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });
const notes = (f: FormData, n: string) => String(f.get(n) ?? "");
function practiceError(error: unknown) {
  const message = (error as Error).message;
  const labels: Record<string, string> = {
    DIRECTOR_REQUIRED: "Esta decisión corresponde al Director del despacho.",
    ADMISSION_ACCEPTANCE_REQUIRED:
      "Primero registrá el encargo, revisá los conflictos y aceptá la admisión.",
    CONFLICT_CHECK_REQUIRED:
      "Repetí la búsqueda de conflictos antes de decidir: el registro cambió o todavía no fue consultado.",
    VERSION_CONFLICT:
      "El registro cambió. Actualizá la vista antes de guardar.",
    BUDGET_ACCEPTANCE_REQUIRED:
      "Vinculá un presupuesto aprobado y aceptado por el cliente, en la misma moneda.",
    APPROVED_VERSION_REQUIRED:
      "La entrega requiere la versión exacta aprobada en la revisión humana.",
    ENTRY_ALREADY_BILLED:
      "Uno de los registros ya está incluido en una liquidación vigente.",
    PAYMENT_EXCEEDS_BALANCE:
      "El importe supera el saldo disponible para ese movimiento.",
    DUPLICATE_PAYMENT_REFERENCE: "Esa referencia de pago ya está registrada.",
    INVOICE_HAS_MOVEMENTS:
      "La liquidación tiene movimientos. Registrá un crédito o devolución para ajustarla.",
    SESSION_TRANSCRIPT_REVIEW_REQUIRED:
      "Falta revisar la transcripción de uno o más segmentos de la sesión.",
    SESSION_TRANSCRIPT_REQUIRED:
      "Incorporá o transcribí el audio de la sesión antes de preparar el acta.",
    TEMPLATE_FIELDS_REQUIRED:
      "Completá los campos requeridos de la plantilla, incluida la identificación del cliente si la utiliza.",
    INVALID_INPUT: "Revisá los campos y el formato indicado antes de guardar.",
  };
  return (
    Object.entries(labels).find(([code]) => message.includes(code))?.[1] ??
    message
  );
}
function Area({
  label,
  name,
  value = "",
  required = true,
}: {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea name={name} defaultValue={value} required={required} rows={4} />
    </label>
  );
}
function CurrencyField({ value = "PYG" }: { value?: string }) {
  return (
    <Field label="Moneda" name="currency" value={value}>
      {["PYG", "USD", "EUR", "ARS", "BRL"].map((c) => (
        <option key={c}>{c}</option>
      ))}
    </Field>
  );
}
function Text({
  name,
  label,
  value = "",
}: {
  name: string;
  label: string;
  value?: string;
}) {
  return <Field name={name} label={label} value={value} />;
}
function DateField({
  name = "date",
  label = "Fecha",
}: {
  name?: string;
  label?: string;
}) {
  return <Field name={name} label={label} type="date" value={today()} />;
}
export type PracticeSection = "admission" | "economy" | "templates" | "portal" | "sessions";
const practiceTabs: readonly (readonly [PracticeSection, string])[] = [
  ["admission", "Admisión"], ["economy", "Honorarios y cobros"],
  ["templates", "Plantillas"], ["portal", "Portal del cliente"], ["sessions", "Sesiones y actas"],
];
export default function PracticePanel({
  firm,
  matter,
  onOpenDraft,
  onChanged = () => {},
  templatesOnly = false,
  initialSection = "admission",
  sectionOnly = false,
  sections,
}: {
  firm: string;
  matter: Matter;
  onOpenDraft: (id: string) => void;
  onChanged?: () => void;
  templatesOnly?: boolean;
  initialSection?: PracticeSection;
  sectionOnly?: boolean;
  sections?: PracticeSection[];
}) {
  const [data, setData] = useState<PracticeView | null>(null),
    [tab, setTab] = useState<PracticeSection>(templatesOnly ? "templates" : initialSection),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState<{ op: string; row?: PracticeRecord } | null>(
      null,
    ),
    [portal, setPortal] = useState("");
  const load = () => api<PracticeView>(`/firms/${firm}/practice`).then(setData);
  const [jobs, setJobs] = useState<any[]>([]);
  const loadJobs = () =>
    platformRequest("session-ai-history", { firm, matter_id: matter.id }).then(
      (r) => setJobs(r.jobs),
    );
  useEffect(() => {
    if (tab !== "sessions") return;
    let active = true;
    platformRequest("session-ai-history", { firm, matter_id: matter.id })
      .then((r) => {
        if (active) setJobs(r.jobs);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [tab, firm, matter.id]);
  useEffect(() => {
    let active = true;
    setData(null);
    const update = () => {
      api<PracticeView>(`/firms/${firm}/practice`)
        .then((d) => {
          if (active) setData(d);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    };
    update();
    window.addEventListener("law-order-work-changed", update);
    return () => {
      active = false;
      window.removeEventListener("law-order-work-changed", update);
    };
  }, [firm, matter.id]);
  const director = data?.role === "ADMINISTRATOR",
    rows = data?.records.filter((r) => r.matter_id === matter.id) ?? [],
    templates =
      data?.records.filter((r) => r.payload.type === "TEMPLATE") ?? [];
  const send = async (op: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      const result = await api<any>(`/firms/${firm}/practice/${op}`, body);
      await load();
      onChanged();
      return result;
    } catch (e) {
      setError(practiceError(e));
      throw Error(practiceError(e));
    } finally {
      setBusy(false);
    }
  };
  const act = (op: string, body: unknown) => {
    void send(op, body).catch(() => {});
  };
  const target = (r: PracticeRecord) => ({
    record_id: r.id,
    expected_revision: r.revision,
  });
  const open = (op: string, row?: PracticeRecord) => setForm({ op, row });
  const audio = async (row: PracticeRecord, transcribe = false) => {
    setBusy(true);
    setError("");
    try {
      const file = await platformRequest("recording-download", {
        firm,
        recording_id: row.id,
      });
      if (transcribe) {
        const wav = await transcriptionWav(file.base64);
        await platformRequest("session-ai", {
          firm,
          record_id: row.id,
          request_id: crypto.randomUUID(),
          action: "TRANSCRIBE",
          budget_usd: 0.6,
          wav_base64: wav,
        });
        await load();
      } else {
        const bytes = Uint8Array.from(atob(file.base64), (c: string) =>
          c.charCodeAt(0),
        );
        saveBlob(
          new Blob([bytes], { type: file.mime }),
          `sesion-${row.id}.${file.mime.includes("ogg") ? "ogg" : file.mime.includes("wav") ? "wav" : "webm"}`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const aiMinutes = async (row: PracticeRecord) => {
    setBusy(true);
    setError("");
    try {
      await platformRequest("session-ai", {
        firm,
        record_id: row.id,
        request_id: crypto.randomUUID(),
        action: "MINUTES",
        budget_usd: 0.6,
        wav_base64: null,
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const versionField = (name: string, label: string, published = false) => (
    <Field name={name} label={label} required={false}>
      <option value="">Sin documento</option>
      {data?.versions
        .filter(
          (v) => v.matter_id === matter.id && (!published || v.publishable),
        )
        .map((v) => (
          <option key={v.id} value={v.id}>
            {v.title} - {new Date(v.created_at).toLocaleString("es-PY")}
          </option>
        ))}
    </Field>
  );
  const save = async (f: FormData) => {
    if (!form) return;
    const { op, row } = form,
      p = row?.payload,
      b: any = {};
    if (op === "save_admission")
      Object.assign(b, {
        matter_id: matter.id,
        record_id: row?.id ?? null,
        expected_revision: row?.revision ?? null,
        scope: notes(f, "scope"),
        exclusions: notes(f, "exclusions"),
        jurisdiction: notes(f, "jurisdiction"),
        parties: notes(f, "parties")
          .split("\n")
          .filter((s) => s.trim())
          .map((s) => {
            const [name, identification = "", side = "RELATED"] = s
              .split("|")
              .map((x) => x.trim());
            return { name, identification, side };
          }),
      });
    if (op === "decide_admission")
      Object.assign(b, target(row!), {
        decision: notes(f, "decision"),
        note: notes(f, "note"),
      });
    if (["save_budget", "issue_invoice"].includes(op)) {
      const currency = notes(f, "currency"),
        lines = notes(f, "lines")
          .split("\n")
          .filter((s) => s.trim())
          .map((s) => {
            const [description, quantity = "1", amount = "0", tax = "0"] = s
              .split("|")
              .map((x) => x.trim());
            return {
              description,
              quantity: Number(quantity),
              unit_amount: amountFromText(amount, currency),
              tax_bps: Math.round(Number(tax) * 100),
            };
          });
      Object.assign(b, { matter_id: matter.id, currency, lines });
      if (op === "save_budget")
        Object.assign(b, {
          record_id: row?.id ?? null,
          expected_revision: row?.revision ?? null,
          title: notes(f, "title"),
          terms: notes(f, "terms"),
        });
      else {
        const budget = rows.find((r) => r.id === notes(f, "budget"));
        Object.assign(b, {
          issued_on: notes(f, "issued"),
          due_on: notes(f, "due"),
          budget_id: budget?.id ?? null,
          budget_revision: budget?.revision ?? null,
          entry_ids: f.getAll("entries"),
          fiscal_reference: notes(f, "fiscal_number")
            ? {
                number: notes(f, "fiscal_number"),
                authorization: notes(f, "fiscal_authorization"),
                issuer_tax_id: notes(f, "fiscal_ruc"),
                document_version_id: notes(f, "fiscal_version"),
              }
            : null,
        });
      }
    }
    if (op === "accept_budget")
      Object.assign(b, target(row!), {
        at: notes(f, "date"),
        reference: notes(f, "reference"),
      });
    if (["cancel_budget", "void_invoice"].includes(op))
      Object.assign(b, target(row!), { reason: notes(f, "reason") });
    if (op === "record_entry")
      Object.assign(b, {
        matter_id: matter.id,
        type: notes(f, "type"),
        description: notes(f, "description"),
        date: notes(f, "date"),
        minutes: Number(notes(f, "minutes") || 0),
        amount: amountFromText(notes(f, "amount") || "0", notes(f, "currency")),
        currency: notes(f, "currency"),
        billable: f.get("billable") === "on",
        proof_version_id: notes(f, "proof") || null,
      });
    if (op === "decide_entry")
      Object.assign(b, target(row!), {
        decision: notes(f, "decision"),
        note: notes(f, "note"),
      });
    if (["record_payment", "credit_invoice"].includes(op)) {
      Object.assign(b, {
        invoice_id: row!.id,
        amount: amountFromText(
          notes(f, "amount"),
          p && "currency" in p ? p.currency : "PYG",
        ),
        date: notes(f, "date"),
      });
      if (op === "credit_invoice") b.reason = notes(f, "reason");
      else
        Object.assign(b, {
          direction: notes(f, "direction"),
          reference: notes(f, "reference"),
          method: notes(f, "method"),
          proof_version_id: notes(f, "proof") || null,
        });
    }
    if (op === "save_template")
      Object.assign(b, {
        record_id: row?.id ?? null,
        expected_revision: row?.revision ?? null,
        title: notes(f, "title"),
        document_type: notes(f, "document_type"),
        jurisdiction: notes(f, "jurisdiction"),
        body: notes(f, "body"),
      });
    if (op === "use_template")
      Object.assign(b, {
        matter_id: matter.id,
        template_id: row!.id,
        expected_revision: row!.revision,
        title: notes(f, "title"),
        values: Object.fromEntries(
          [...f.entries()]
            .filter(([k]) => k.startsWith("value:"))
            .map(([k, v]) => [k.slice(6), String(v)]),
        ),
      });
    if (op === "publish_delivery")
      Object.assign(b, {
        matter_id: matter.id,
        title: notes(f, "title"),
        message: notes(f, "message"),
        document_version_id: notes(f, "version") || null,
        explicitly_confirmed: f.get("confirmed") === "on",
      });
    if (op === "grant_portal")
      Object.assign(b, {
        matter_id: matter.id,
        recipient: notes(f, "recipient"),
        expires_at: new Date(
          notes(f, "expires") + "T23:59:59-03:00",
        ).toISOString(),
        allow_messages: f.get("messages") === "on",
      });
    if (op === "send_message")
      Object.assign(b, { matter_id: matter.id, text: notes(f, "message") });
    if (op === "create_session")
      Object.assign(b, {
        matter_id: matter.id,
        title: notes(f, "title"),
        room_id: null,
      });
    if (op === "save_transcript")
      Object.assign(b, { session_id: row!.id, text: notes(f, "text") });
    if (op === "review_transcript")
      Object.assign(b, target(row!), { text: notes(f, "text") });
    if (op === "save_minutes")
      Object.assign(b, {
        session_id: (p as any).session_id,
        transcript_id: p?.type === "MINUTES" ? p.transcript_id : row!.id,
        record_id: p?.type === "MINUTES" ? row!.id : null,
        expected_revision: p?.type === "MINUTES" ? row!.revision : null,
        summary: notes(f, "summary"),
        agreements: notes(f, "agreements").split("\n").filter(Boolean),
        disagreements: notes(f, "disagreements").split("\n").filter(Boolean),
        actions: notes(f, "actions")
          .split("\n")
          .filter(Boolean)
          .map((description) => ({
            description,
            responsible_identity_id: null,
            due_at: null,
          })),
      });
    if (op === "assign_minute_action")
      Object.assign(b, target(row!), {
        action_id: notes(f, "action"),
        responsible_identity_id: notes(f, "responsible"),
        internal_due_at: notes(f, "due")
          ? new Date(notes(f, "due") + "T18:00:00-03:00").toISOString()
          : null,
      });
    const result = await send(op, b);
    // A completed request must not close a different form opened meanwhile.
    setForm((current) => current === form ? null : current);
    if (result.token) setPortal(`${location.origin}/#portal=${result.token}`);
    if (result.draft) onOpenDraft(result.draft.id);
  };
  const card = (r: PracticeRecord) => {
    const p = r.payload;
    return (
      <article className="practice-card" key={r.id}>
        <header>
          <strong>
            {"title" in p
              ? p.title
              : "number" in p
                ? p.number
                : "description" in p
                  ? p.description
                  : (labels[p.type] ?? p.type)}
          </strong>
          <span>
            {"status" in p ? (labels[p.status] ?? p.status) : ""} · v
            {r.revision}
          </span>
        </header>
        {p.type === "ADMISSION" && (
          <>
            <p>{p.scope}</p>
            <p className="muted">
              {p.jurisdiction} · {p.parties.map((x) => x.name).join(", ")}
            </p>
            {p.conflict_check && (
              <details>
                <summary>
                  {p.conflict_check.matches.length} coincidencias para revisar
                </summary>
                {p.conflict_check.matches.map((m, i) => (
                  <p key={i}>
                    {m.label}: {m.reason}
                  </p>
                ))}
              </details>
            )}
            <div className="practice-actions">
              {(director || p.status === "PROPOSED") && (
                <button onClick={() => open("save_admission", r)}>
                  Editar encargo
                </button>
              )}
              {director && (
                <>
                  <button onClick={() => act("check_conflicts", target(r))}>
                    Buscar conflictos
                  </button>
                  <button
                    disabled={!p.conflict_check}
                    onClick={() => open("decide_admission", r)}
                  >
                    Decidir admisión
                  </button>
                </>
              )}
            </div>
            {p.decision_note && <p>{p.decision_note}</p>}
          </>
        )}
        {p.type === "BUDGET" && (
          <>
            <p>{p.terms}</p>
            <p>
              <strong>Total {money(lineTotal(p.lines), p.currency)}</strong>
            </p>
            <ul>
              {p.lines.map((l, i) => (
                <li key={i}>
                  {l.description} · {l.quantity} ×{" "}
                  {money(l.unit_amount, p.currency)}
                </li>
              ))}
            </ul>
            <div className="practice-actions">
              {p.status === "DRAFT" && (
                <>
                  <button onClick={() => open("save_budget", r)}>Editar</button>
                  <button onClick={() => act("approve_budget", target(r))}>
                    Aprobar
                  </button>
                </>
              )}
              {p.status === "APPROVED" && (
                <button onClick={() => open("accept_budget", r)}>
                  Registrar aceptación del cliente
                </button>
              )}
              {p.status !== "CANCELLED" && (
                <button onClick={() => open("cancel_budget", r)}>
                  Cancelar con motivo
                </button>
              )}
            </div>
          </>
        )}
        {(p.type === "TIME" || p.type === "EXPENSE") && (
          <>
            <p>
              {p.date} ·{" "}
              {p.type === "TIME"
                ? `${p.minutes} minutos`
                : money(p.amount, p.currency)}{" "}
              · {p.billable ? "Facturable" : "Interno"}
            </p>
            {director && p.status === "SUBMITTED" && (
              <button onClick={() => open("decide_entry", r)}>
                Revisar registro
              </button>
            )}
          </>
        )}
        {p.type === "INVOICE" && (
          <>
            <p>
              {money(p.total, p.currency)} · Vence {p.due_on}
            </p>
            <p>
              <strong>
                Saldo{" "}
                {money(
                  data?.balances.find((b) => b.id === r.id)?.balance ?? 0,
                  p.currency,
                )}
              </strong>
            </p>
            <p className="muted">
              Liquidación interna{" "}
              {p.fiscal_reference
                ? `· Factura externa registrada ${p.fiscal_reference.number}`
                : "· Sin factura fiscal registrada"}
            </p>
            <details>
              <summary>Conceptos y movimientos</summary>
              {p.lines.map((l, i) => (
                <p key={i}>
                  {l.description} · {l.quantity} ×{" "}
                  {money(l.unit_amount, p.currency)} · Impuesto{" "}
                  {l.tax_bps / 100}%
                </p>
              ))}
              {rows
                .filter(
                  (x) =>
                    "invoice_id" in x.payload && x.payload.invoice_id === r.id,
                )
                .map((x) => (
                  <p key={x.id}>
                    {x.payload.type === "PAYMENT"
                      ? x.payload.direction === "RECEIPT"
                        ? "Cobro"
                        : "Devolución"
                      : "Crédito"}{" "}
                    ·{" "}
                    {"amount" in x.payload
                      ? money(x.payload.amount, p.currency)
                      : ""}{" "}
                    · {"reference" in x.payload ? x.payload.reference : ""}
                  </p>
                ))}
            </details>
            {p.status === "ISSUED" && (
              <div className="practice-actions">
                <button onClick={() => open("record_payment", r)}>
                  Registrar pago / devolución
                </button>
                <button onClick={() => open("credit_invoice", r)}>
                  Crédito
                </button>
                <button onClick={() => open("void_invoice", r)}>Anular</button>
              </div>
            )}
          </>
        )}
        {p.type === "TEMPLATE" && (
          <>
            <p>
              {p.document_type} · {p.jurisdiction}
            </p>
            <details>
              <summary>Ver contenido y campos</summary>
              <pre>{p.body}</pre>
            </details>
            <div className="practice-actions">
              {data?.approved_templates.some((t) => t.id === r.id) && (
                <button
                  onClick={() =>
                    open(
                      "use_template",
                      data!.approved_templates.find((t) => t.id === r.id)!,
                    )
                  }
                >
                  Crear en el editor
                </button>
              )}
              {director && (
                <>
                  <button onClick={() => open("save_template", r)}>
                    Nueva revisión
                  </button>
                  {p.status === "DRAFT" && (
                    <button onClick={() => act("approve_template", target(r))}>
                      Aprobar plantilla
                    </button>
                  )}
                  {p.status !== "RETIRED" && (
                    <button onClick={() => act("retire_template", target(r))}>
                      Retirar
                    </button>
                  )}
                </>
              )}
            </div>
            {director && (
              <details>
                <summary>Historial de esta plantilla</summary>
                {data?.events
                  .filter((e: any) => e.record_id === r.id)
                  .map((e: any) => (
                    <section key={e.id}>
                      <strong>
                        Revisión {e.revision} ·{" "}
                        {labels[e.after.status] ?? e.after.status}
                      </strong>
                      <small>{new Date(e.at).toLocaleString("es-PY")}</small>
                      <pre>{e.after.body}</pre>
                    </section>
                  ))}
              </details>
            )}
          </>
        )}
        {p.type === "PUBLICATION" && (
          <>
            <p>{p.message}</p>
            <p>
              {p.document_version_id
                ? `Documento entregado: ${data?.versions.find((v) => v.id === p.document_version_id)?.title ?? "Version publicada"}`
                : "Comunicación"}
            </p>
            {p.status === "PUBLISHED" && director && (
              <button onClick={() => act("withdraw_publication", target(r))}>
                Retirar del portal
              </button>
            )}
          </>
        )}
        {p.type === "PORTAL_GRANT" && (
          <>
            <p>
              {p.recipient} · Hasta{" "}
              {new Date(p.expires_at).toLocaleDateString("es-PY")} ·{" "}
              {p.revoked_at ? "Revocado" : "Activo"}
            </p>
            {!p.revoked_at && (
              <button onClick={() => act("revoke_portal", target(r))}>
                Revocar acceso
              </button>
            )}
          </>
        )}
        {p.type === "PORTAL_MESSAGE" && (
          <p>
            {p.author_name}: {p.text}
          </p>
        )}
        {p.type === "SESSION" && (
          <>
            <p>
              {p.recording_status === "RECORDING"
                ? "Grabando"
                : (labels[p.recording_status] ?? p.recording_status)}{" "}
              · {new Date(r.created_at).toLocaleString("es-PY")}
            </p>
            <button onClick={() => open("save_transcript", r)}>
              Incorporar transcripción
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void send("combine_transcripts", { session_id: r.id })
                  .then(aiMinutes)
                  .catch(() => {})
              }
            >
              Acta IA de toda la sesión revisada · hasta USD 0,60
            </button>
          </>
        )}
        {p.type === "RECORDING" && (
          <>
            <p>
              Segmento {p.sequence + 1} · {Math.ceil(p.bytes / 1024)} KB · Audio
              guardado en el asunto
            </p>
            <button disabled={busy} onClick={() => void audio(r)}>
              Descargar audio
            </button>
            <button disabled={busy} onClick={() => void audio(r, true)}>
              Transcribir con IA · envío a OpenAI
            </button>
            <small>
              Estimación USD 0,003/minuto. La transcripción queda por revisar;
              no identifica hablantes automáticamente.
            </small>
          </>
        )}
        {p.type === "TRANSCRIPT" && (
          <>
            <details>
              <summary>
                Transcripción ·{" "}
                {p.status === "REVIEWED"
                  ? "Revisada por humano"
                  : "IA, requiere revisión"}
              </summary>
              <pre>{p.text}</pre>
            </details>
            <button onClick={() => open("review_transcript", r)}>
              Revisar transcripción
            </button>
            <button onClick={() => open("save_minutes", r)}>
              Escribir acta revisable
            </button>
            {p.status === "REVIEWED" && (
              <button disabled={busy} onClick={() => void aiMinutes(r)}>
                Proponer acta con Luna · hasta USD 0,60
              </button>
            )}
          </>
        )}
        {p.type === "MINUTES" && (
          <>
            <p>{p.summary}</p>
            <details>
              <summary>Acuerdos, desacuerdos y acciones</summary>
              <h4>Acuerdos</h4>
              {p.agreements.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
              <h4>Desacuerdos</h4>
              {p.disagreements.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
              {p.actions.map((a) => (
                <p key={a.id}>
                  {a.description} · {a.task_id ? "Asignada" : "Propuesta"}
                </p>
              ))}
            </details>
            {p.status === "PROPOSED" && (
              <button onClick={() => open("save_minutes", r)}>
                Revisar y ajustar acta
              </button>
            )}
            {director &&
              (p.status === "PROPOSED" ? (
                <button onClick={() => act("approve_minutes", target(r))}>
                  Aprobar acta
                </button>
              ) : (
                <button onClick={() => open("assign_minute_action", r)}>
                  Asignar una acción
                </button>
              ))}
          </>
        )}
        <small className="muted">
          {availableProfiles().find((a) => a.id === r.created_by)
            ?.display_name ?? r.created_by}{" "}
          · {new Date(r.updated_at).toLocaleString("es-PY")}
        </small>
      </article>
    );
  };
  const types: Record<string, string[]> = {
    admission: ["ADMISSION"],
    economy: ["BUDGET", "TIME", "EXPENSE", "INVOICE"],
    templates: ["TEMPLATE"],
    portal: ["PUBLICATION", "PORTAL_GRANT", "PORTAL_MESSAGE"],
    sessions: ["SESSION", "RECORDING", "TRANSCRIPT", "MINUTES"],
  };
  return (
    <div className="practice-panel" aria-busy={busy}>
      {!templatesOnly && !sectionOnly && (
        <nav className="practice-tabs" aria-label="Gestión del asunto">
          {practiceTabs
            .filter(([k]) => (director || k !== "portal") && (!sections || sections.includes(k)))
            .map(([k, l]) => (
              <button
                key={k}
                aria-pressed={tab === k}
                onClick={() => {
                  setTab(k);
                  setForm(null);
                }}
              >
                {l}
              </button>
            ))}
        </nav>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Cargando gestión autorizada…</p>
      ) : (
        <>
          <div className="practice-actions">
            {tab === "admission" &&
              !rows.some((r) => r.payload.type === "ADMISSION") && (
                <button onClick={() => open("save_admission")}>
                  Registrar encargo
                </button>
              )}
            {tab === "economy" && (
              <>
                {director && (
                  <>
                    <button onClick={() => open("save_budget")}>
                      Nuevo presupuesto
                    </button>
                    <button onClick={() => open("issue_invoice")}>
                      Liquidar honorarios
                    </button>
                  </>
                )}
                <button onClick={() => open("record_entry")}>
                  Registrar trabajo / gasto
                </button>
              </>
            )}
            {tab === "templates" && director && (
              <button onClick={() => open("save_template")}>
                Nueva plantilla del estudio
              </button>
            )}
            {tab === "portal" && director && (
              <>
                <button onClick={() => open("publish_delivery")}>
                  Publicar entrega revisada
                </button>
                <button onClick={() => open("grant_portal")}>
                  Crear acceso del cliente
                </button>
                <button onClick={() => open("send_message")}>
                  Publicar comunicación
                </button>
              </>
            )}
            {tab === "sessions" && (
              <button onClick={() => open("create_session")}>
                Registrar sesión
              </button>
            )}
          </div>
          {tab === "economy" && (
            <p className="muted">
              Importes por moneda, sin conversión automática. Las liquidaciones
              son internas; la factura fiscal emitida se registra con su
              documento original.
            </p>
          )}
          {tab === "sessions" && (
            <details
              onToggle={(e) => {
                if (e.currentTarget.open)
                  void loadJobs().catch((e) => setError(e.message));
              }}
            >
              <summary>Preparaciones IA y resultados conservados</summary>
              {jobs.map((job) => (
                <article className="practice-card" key={job.id}>
                  <strong>
                    {job.status === "COMPLETED"
                      ? "Propuesta guardada"
                      : job.status === "RUNNING"
                        ? "En preparación o pendiente de recuperar"
                        : "Preparación interrumpida"}
                  </strong>
                  <p>
                    {new Date(job.created_at).toLocaleString("es-PY")} · USD{" "}
                    {Number(job.cost_usd).toFixed(4)} ·{" "}
                    {job.cost_kind === "RESERVED_USAGE_UNKNOWN"
                      ? "Reserva, consumo pendiente de conciliar"
                      : "Consumo estimado"}
                  </p>
                  {job.result?.generated && (
                    <>
                      <details>
                        <summary>Ver aportes conservados</summary>
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          {job.result.generated.payload?.summary ??
                            job.result.generated.payload?.text}
                        </p>
                      </details>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void platformRequest("session-ai-recover", {
                            job_id: job.id,
                          })
                            .then(async () => {
                              await load();
                              await loadJobs();
                            })
                            .catch((e) => setError(practiceError(e)))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Recuperar propuesta sin otra llamada IA
                      </button>
                    </>
                  )}
                  {job.status !== "COMPLETED" && !job.result?.generated && (
                    <p>
                      El resultado del proveedor es incierto. No se vuelve a
                      ejecutar ni se presenta como terminado automáticamente.
                    </p>
                  )}
                </article>
              ))}
            </details>
          )}
          {portal && (
            <section className="practice-card">
              <strong>Acceso del cliente · copiá este enlace ahora</strong>
              <input
                aria-label="Enlace del portal"
                value={portal}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(portal)
                    .catch(() =>
                      setError("Seleccioná y copiá el enlace manualmente."),
                    );
                }}
              >
                Copiar enlace
              </button>
              <p>
                Compartilo con el destinatario. Permite acceder hasta su
                vencimiento o revocación.
              </p>
            </section>
          )}
          {form && (
            <Form
              key={form.op + (form.row?.id ?? "")}
              title={
                {
                  save_admission: "Alcance y partes del encargo",
                  decide_admission: "Decisión profesional de admisión",
                  save_budget: "Presupuesto de honorarios",
                  issue_invoice: "Liquidación interna y factura emitida",
                  record_entry: "Trabajo y gastos",
                  save_template: "Plantilla versionada",
                  use_template: "Crear documento desde plantilla",
                  publish_delivery: "Publicar una versión revisada",
                  grant_portal: "Acceso limitado al cliente",
                  create_session: "Sesión del asunto",
                  save_transcript: "Transcripción de la sesión",
                  save_minutes: "Propuesta de acta",
                  assign_minute_action: "Asignación por Dirección",
                }[form.op] ?? "Registrar movimiento"
              }
              onSave={save}
              onClose={() => setForm(null)}
              footerText="Guardado central · permisos del despacho · historial de revisiones"
            >
              {form.op === "save_admission" && (
                <>
                  <Area
                    label="Alcance del encargo"
                    name="scope"
                    value={
                      form.row?.payload.type === "ADMISSION"
                        ? form.row.payload.scope
                        : ""
                    }
                  />
                  <Area
                    label="Exclusiones"
                    name="exclusions"
                    required={false}
                    value={
                      form.row?.payload.type === "ADMISSION"
                        ? form.row.payload.exclusions
                        : ""
                    }
                  />
                  <Text
                    label="Jurisdicción"
                    name="jurisdiction"
                    value={
                      form.row?.payload.type === "ADMISSION"
                        ? form.row.payload.jurisdiction
                        : "Paraguay"
                    }
                  />
                  <Area
                    label="Partes: nombre | identificación | CLIENT, COUNTERPARTY o RELATED (una por línea)"
                    name="parties"
                    value={
                      form.row?.payload.type === "ADMISSION"
                        ? form.row.payload.parties
                            .map(
                              (p) =>
                                `${p.name} | ${p.identification} | ${p.side}`,
                            )
                            .join("\n")
                        : ""
                    }
                  />
                </>
              )}
              {form.op === "decide_admission" && (
                <>
                  <Field label="Decisión" name="decision">
                    <option value="ACCEPTED">Aceptar encargo</option>
                    <option value="DECLINED">Rechazar encargo</option>
                  </Field>
                  <Area
                    label="Fundamento y tratamiento de coincidencias"
                    name="note"
                  />
                </>
              )}
              {["save_budget", "issue_invoice"].includes(form.op) && (
                <>
                  <CurrencyField
                    value={
                      form.row?.payload.type === "BUDGET"
                        ? form.row.payload.currency
                        : "PYG"
                    }
                  />
                  <Area
                    label="Conceptos: descripción | cantidad | importe unitario | impuesto % (una línea por concepto)"
                    name="lines"
                    value={
                      form.row?.payload.type === "BUDGET"
                        ? form.row.payload.lines
                            .map(
                              (l) =>
                                `${l.description} | ${l.quantity} | ${l.unit_amount / 10 ** moneyDigits(form.row!.payload.type === "BUDGET" ? form.row!.payload.currency : "PYG")} | ${l.tax_bps / 100}`,
                            )
                            .join("\n")
                        : ""
                    }
                  />
                  {form.op === "save_budget" ? (
                    <>
                      <Text
                        label="Título"
                        name="title"
                        value={
                          form.row?.payload.type === "BUDGET"
                            ? form.row.payload.title
                            : ""
                        }
                      />
                      <Area
                        label="Condiciones y acuerdo de honorarios"
                        name="terms"
                        value={
                          form.row?.payload.type === "BUDGET"
                            ? form.row.payload.terms
                            : ""
                        }
                      />
                    </>
                  ) : (
                    <>
                      <DateField name="issued" label="Fecha de emisión" />
                      <DateField name="due" label="Fecha de vencimiento" />
                      <Field
                        name="budget"
                        label="Presupuesto aceptado"
                        required={false}
                      >
                        <option value="">Sin vincular</option>
                        {rows
                          .filter(
                            (r) =>
                              r.payload.type === "BUDGET" &&
                              r.payload.status === "ACCEPTED",
                          )
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.payload.type === "BUDGET"
                                ? r.payload.title
                                : ""}
                            </option>
                          ))}
                      </Field>
                      <fieldset>
                        <legend>Trabajo y gastos aprobados incluidos</legend>
                        {rows
                          .filter(
                            (r) =>
                              (r.payload.type === "TIME" ||
                                r.payload.type === "EXPENSE") &&
                              r.payload.status === "APPROVED" &&
                              r.payload.billable,
                          )
                          .map((r) => (
                            <label key={r.id}>
                              <input
                                type="checkbox"
                                name="entries"
                                value={r.id}
                              />
                              {"description" in r.payload
                                ? r.payload.description
                                : ""}
                            </label>
                          ))}
                      </fieldset>
                      <details>
                        <summary>
                          Registrar factura fiscal ya emitida (opcional)
                        </summary>
                        <Field
                          label="Número fiscal"
                          name="fiscal_number"
                          required={false}
                        />
                        <Field
                          label="Timbrado / autorización"
                          name="fiscal_authorization"
                          required={false}
                        />
                        <Field
                          label="RUC emisor"
                          name="fiscal_ruc"
                          required={false}
                        />
                        {versionField(
                          "fiscal_version",
                          "Documento original de la factura",
                          false,
                        )}
                      </details>
                    </>
                  )}
                </>
              )}
              {form.op === "accept_budget" && (
                <>
                  <DateField />
                  <Text
                    name="reference"
                    label="Constancia de aceptación del cliente"
                  />
                </>
              )}
              {["cancel_budget", "void_invoice", "credit_invoice"].includes(
                form.op,
              ) && <Area name="reason" label="Motivo del ajuste" />}
              {form.op === "record_entry" && (
                <>
                  <Field label="Registro" name="type">
                    <option value="TIME">Trabajo</option>
                    <option value="EXPENSE">Gasto</option>
                  </Field>
                  <Area label="Descripción" name="description" />
                  <DateField />
                  <Field
                    label="Minutos de trabajo (0 para gasto)"
                    name="minutes"
                    type="number"
                    value="0"
                  />
                  <Text
                    label="Importe del gasto (0 para trabajo)"
                    name="amount"
                    value="0"
                  />
                  <CurrencyField />
                  <label>
                    <input name="billable" type="checkbox" defaultChecked />
                    Facturable al cliente
                  </label>
                  {versionField(
                    "proof",
                    "Documento del comprobante (opcional)",
                    false,
                  )}
                </>
              )}
              {form.op === "decide_entry" && (
                <>
                  <Field label="Decisión" name="decision">
                    <option value="APPROVED">Aprobar</option>
                    <option value="REJECTED">Rechazar</option>
                  </Field>
                  <Area label="Observación de Dirección" name="note" />
                </>
              )}
              {["record_payment", "credit_invoice"].includes(form.op) && (
                <>
                  <Text label="Importe" name="amount" />
                  <DateField />
                </>
              )}
              {form.op === "record_payment" && (
                <>
                  <Field label="Movimiento" name="direction">
                    <option value="RECEIPT">Cobro</option>
                    <option value="REFUND">Devolución de saldo a favor</option>
                  </Field>
                  <Text label="Referencia única del pago" name="reference" />
                  <Field label="Medio" name="method">
                    <option value="BANK">Transferencia</option>
                    <option value="CASH">Efectivo</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="OTHER">Otro</option>
                  </Field>
                  {versionField(
                    "proof",
                    "Documento del comprobante (opcional)",
                    false,
                  )}
                </>
              )}
              {form.op === "save_template" && (
                <>
                  <Text
                    name="title"
                    label="Nombre de plantilla"
                    value={
                      form.row?.payload.type === "TEMPLATE"
                        ? form.row.payload.title
                        : ""
                    }
                  />
                  <Text
                    name="document_type"
                    label="Tipo de documento"
                    value={
                      form.row?.payload.type === "TEMPLATE"
                        ? form.row.payload.document_type
                        : ""
                    }
                  />
                  <Text
                    name="jurisdiction"
                    label="Jurisdicción"
                    value={
                      form.row?.payload.type === "TEMPLATE"
                        ? form.row.payload.jurisdiction
                        : "Paraguay"
                    }
                  />
                  <Area
                    name="body"
                    label="Contenido. Campos: {{cliente.nombre}}, {{asunto.titulo}} o {{campo.personalizado}}"
                    value={
                      form.row?.payload.type === "TEMPLATE"
                        ? form.row.payload.body
                        : ""
                    }
                  />
                </>
              )}
              {form.op === "use_template" &&
                form.row?.payload.type === "TEMPLATE" && (
                  <>
                    <Text
                      name="title"
                      label="Título del documento"
                      value={form.row.payload.title}
                    />
                    {[
                      ...new Set(
                        [
                          ...form.row.payload.body.matchAll(
                            /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
                          ),
                        ].map((m) => m[1]!),
                      ),
                    ].map((k) => (
                      <Text
                        key={k}
                        name={"value:" + k}
                        label={k}
                        value={data?.template_values[matter.id]?.[k] ?? ""}
                      />
                    ))}
                  </>
                )}
              {form.op === "publish_delivery" && (
                <>
                  <Text name="title" label="Título de la entrega" />
                  <Area
                    name="message"
                    label="Mensaje al cliente"
                    required={false}
                  />
                  {versionField(
                    "version",
                    "Version revisada para entregar",
                    true,
                  )}
                  <label>
                    <input type="checkbox" name="confirmed" required />
                    Revisé esta versión exacta y autorizo su publicación al
                    cliente.
                  </label>
                </>
              )}
              {form.op === "grant_portal" && (
                <>
                  <Text name="recipient" label="Destinatario" />
                  <DateField name="expires" label="Vencimiento del acceso" />
                  <label>
                    <input type="checkbox" name="messages" defaultChecked />
                    Permitir mensajes del cliente
                  </label>
                </>
              )}
              {form.op === "send_message" && (
                <Area name="message" label="Comunicación para el cliente" />
              )}
              {form.op === "create_session" && (
                <Text name="title" label="Título de la sesión" />
              )}
              {["save_transcript", "review_transcript"].includes(form.op) && (
                <Area
                  name="text"
                  label="Transcripción revisada"
                  value={
                    form.row?.payload.type === "TRANSCRIPT"
                      ? form.row.payload.text
                      : ""
                  }
                />
              )}
              {form.op === "save_minutes" && (
                <>
                  <Area
                    name="summary"
                    label="Resumen"
                    value={
                      form.row?.payload.type === "MINUTES"
                        ? form.row.payload.summary
                        : ""
                    }
                  />
                  <Area
                    name="agreements"
                    label="Acuerdos (uno por línea)"
                    required={false}
                    value={
                      form.row?.payload.type === "MINUTES"
                        ? form.row.payload.agreements.join("\n")
                        : ""
                    }
                  />
                  <Area
                    name="disagreements"
                    label="Desacuerdos (uno por línea)"
                    required={false}
                    value={
                      form.row?.payload.type === "MINUTES"
                        ? form.row.payload.disagreements.join("\n")
                        : ""
                    }
                  />
                  <Area
                    name="actions"
                    label="Acciones propuestas (una por línea, sin asignación automática)"
                    required={false}
                    value={
                      form.row?.payload.type === "MINUTES"
                        ? form.row.payload.actions
                            .map((a) => a.description)
                            .join("\n")
                        : ""
                    }
                  />
                </>
              )}
              {form.op === "assign_minute_action" &&
                form.row?.payload.type === "MINUTES" && (
                  <>
                    <Field name="action" label="Acción aprobada">
                      {form.row.payload.actions
                        .filter((a) => !a.task_id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.description}
                          </option>
                        ))}
                    </Field>
                    <Field name="responsible" label="Abogado responsable">
                      {availableProfiles().map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.display_name}
                        </option>
                      ))}
                    </Field>
                    <Field
                      name="due"
                      label="Vencimiento interno, opcional"
                      type="date"
                      required={false}
                    />
                  </>
                )}
            </Form>
          )}
          <div className="practice-grid">
            {(tab === "templates" ? templates : rows)
              .filter((r) => types[tab]?.includes(r.payload.type))
              .map(card)}
          </div>
          {!(tab === "templates" ? templates : rows).some((r) =>
            types[tab]?.includes(r.payload.type),
          ) && (
            <p className="muted">Todavía no hay registros en esta sección.</p>
          )}
          {director && (
            <details>
              <summary>
                Historial de gestión · {data.events.length} cambios del estudio
              </summary>
              <p>Las revisiones conservan autor, fecha y contenido anterior.</p>
              <ol>
                {data.events
                  .filter((e: any) => e.matter_id === matter.id)
                  .slice(-100)
                  .reverse()
                  .map((e: any) => (
                    <li key={e.id}>
                      <strong>
                        {availableProfiles().find((p) => p.id === e.actor)
                          ?.display_name ??
                          (e.actor.startsWith("system:")
                            ? "Sistema"
                            : e.actor.startsWith("external:")
                              ? "Cliente"
                              : "Autor historico")}
                      </strong>{" "}
                      - {labels[e.after.type] ?? e.after.title ?? e.after.type}{" "}
                      -{" "}
                      {e.after.status
                        ? (labels[e.after.status] ?? e.after.status)
                        : "Registrado"}{" "}
                      - revision {e.revision}
                      <small> {new Date(e.at).toLocaleString("es-PY")}</small>
                    </li>
                  ))}
              </ol>
            </details>
          )}
        </>
      )}
    </div>
  );
}
