import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type {
  Client,
  LawFirm,
  Matter,
  Task,
  Document,
  Draft,
  DraftReview,
  Membership,
  Identity,
  Activity,
  Proceeding,
  Delivery,
  MatterParticipant,
} from "../../../os-core/src/contracts.js";
import { api, setCsrf, localMode, content, download, saveBlob } from "./api.js";
import { browserStore, selectLocalProfile } from "./local-api.js";
import { STORAGE_KEY, parseSnapshot } from "./local-storage.js";
import { Field, Form, Empty, Badge, DataTable } from "./components.js";
import LegalLibrary from "./LegalLibrary.js";
const LegalTeam = lazy(() => import("./LegalWorkspace.js"));
const LegalTeamOverview = lazy(() => import("./LegalTeamOverview.js"));
const DirectorDashboard = lazy(() => import("./DirectorDashboard.js"));
const GabrielAssistant = lazy(() => import("./GabrielAssistant.js"));
const WorkspacePanel = lazy(() => import("./WorkspacePanel.js"));
const PracticePanel = lazy(() => import("./PracticePanel.js"));
const OfficeFinance = lazy(() => import("./OfficeManagement.js").then(m=>({default:m.OfficeFinance})));
const ClientAppointments = lazy(() => import("./OfficeManagement.js").then(m=>({default:m.ClientAppointments})));
const MatterAdministration = lazy(() => import("./OfficeManagement.js").then(m=>({default:m.MatterAdministration})));
import NavIcon from "./NavIcon.js";
import "./office-management.css";
import "./office-dashboards.css";
import PlatformSettings from "./PlatformSettings.js";
import { DeadlineForm } from "./Deadlines.js";
import WorkManagement, {
  DirectionRequestForm,
  WorkDialog,
  type WorkBoardData,
} from "./WorkManagement.js";
import {
  roleLabel,
  taskAssigner,
} from "../../../os-core/src/work-management.js";
import {
  centralEnabled,
  availableProfiles,
  accountProfiles,
  signOut,
} from "./platform-client.js";
import {
  ClientDirectory,
  ClientSummary,
  MatterDirectory,
  TaskAgenda,
  DailyFocus,
  WorkOverview,
  SectionEmpty,
} from "./WorkspaceViews.js";
import {
  activityLabels,
  permissionLabels,
  matterKind,
  displayDate,
  matchesSearch,
} from "./workspace-model.js";
type Session = { identity: Identity; firms: LawFirm[]; csrf: string };
type Rows = {
  clients: Client[];
  matters: Matter[];
  members: Membership[];
  tasks: Array<Task & { matter_title?: string }>;
  documents: Document[];
  drafts: Draft[];
  reviews: DraftReview[];
  activity: Activity[];
  proceedings: Proceeding[];
  deliveries: Delivery[];
  participants: MatterParticipant[];
};
const initial: Rows = {
  clients: [],
  matters: [],
  members: [],
  tasks: [],
  documents: [],
  drafts: [],
  reviews: [],
  activity: [],
  proceedings: [],
  deliveries: [],
  participants: [],
};
const SIDEBAR_PREFERENCE_KEY = "law-order-os.ui.sidebar-collapsed.v1";
const nav = [
  ["dashboard", "Dashboard", ""],
  ["day", "Mi día", "◷"],
  ["clients", "Clientes", "♙"],
  ["matters", "Asuntos", "▤"],
  ["agenda", "Agenda", "▦"],
  ["deadlines", "Plazos y tareas", ""],
  ["team", "Equipo jurídico", ""],
  ["work", "Trabajo jurídico", "▧"],
  ["library", "Biblioteca jurídica", "▥"],
  ["finance", "Finanzas", ""],
  ["admin", "Administración", "≡"],
] as const;
const status = (s: string) =>
  (
    ({
      PENDING: "Pendiente",
      DONE: "Hecha",
      OPEN: "Abierto",
      CLOSED: "Cerrado",
      DRAFT: "Borrador",
      IN_REVIEW: "En revisión",
      APPROVED: "Aprobado",
      CHANGES_REQUESTED: "Cambios solicitados",
      SUPERSEDED: "Superada",
      CANCELLED: "Cancelada",
    }) as Record<string, string>
  )[s] ?? s;
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-PY", {
        day: "2-digit",
        month: "short",
        timeZone: "America/Asuncion",
      }).format(new Date(value))
    : "Sin fecha";
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [firm, setFirm] = useState(""),
    [view, setView] = useState("dashboard"),
    [workLanding, setWorkLanding] = useState<"deadlines" | "tasks">("deadlines"),
    [practiceSection, setPracticeSection] = useState<import("./PracticePanel.js").PracticeSection>("admission"),
    [gabrielLaunch, setGabrielLaunch] = useState(0),
    [gabrielWorkspaceRevision, setGabrielWorkspaceRevision] = useState(0),
    [matter, setMatter] = useState<Matter | null>(null),
    [tab, setTab] = useState(localMode ? "workspace" : "documents");
  const [rows, setRows] = useState<Rows>(initial),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [form, setForm] = useState(""),
    [search, setSearch] = useState(""),
    [revision, setRevision] = useState(0),
    [workspaceNewDocument, setWorkspaceNewDocument] = useState(0),
    [workspaceRequestedDraft, setWorkspaceRequestedDraft] = useState<string>(),
    [collapsed, setCollapsed] = useState(() => {
      try {
        return localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true";
      } catch {
        return false;
      }
    });
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(collapsed));
    } catch {
      /* The menu still works when browser preference storage is unavailable. */
    }
  }, [collapsed]);
  const [editDraft, setEditDraft] = useState<Draft | null>(null),
    [draftText, setDraftText] = useState("");
  const [clientContext, setClientContext] = useState<Client | null>(null);
  const [editTask, setEditTask] = useState<Task>();
  const [requestTask, setRequestTask] = useState<Task>();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, matter?.id, tab, clientContext?.id]);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    api<Session>("/session", undefined, abort.signal)
      .then((s) => {
        if (abort.signal.aborted) return;
        setCsrf(s.csrf);
        setSession(s);
        setFirm(s.firms[0]?.id ?? "");
      })
      .catch((e) => {
        if (localMode && !abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!localMode) return;
    const changed = (event: StorageEvent) => {
      if (
        event.key === STORAGE_KEY ||
        event.key === "law-order-os.local.profile"
      )
        location.reload();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    if (!session || !firm) {
      setRows(initial);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setRows(initial);
    const F = "/firms/" + firm;
    const common = Promise.all([
      api<Client[]>(F + "/clients", undefined, abort.signal).catch((error) => {
        if (centralEnabled() && error.code === "ACCESS_DENIED")
          return browserStore()
            .snapshot()
            .tables.clients.filter((c) => c.law_firm_id === firm);
        throw error;
      }),
      api<Matter[]>(F + "/matters", undefined, abort.signal),
      api<Membership[]>(F + "/memberships", undefined, abort.signal),
    ]);
    const detail = matter
      ? Promise.all([
          api<Document[]>(
            F + "/matters/" + matter.id + "/documents",
            undefined,
            abort.signal,
          ),
          api<Task[]>(
            F + "/matters/" + matter.id + "/tasks",
            undefined,
            abort.signal,
          ),
          api<Draft[]>(
            F + "/matters/" + matter.id + "/drafts",
            undefined,
            abort.signal,
          ),
          api<DraftReview[]>(
            F + "/matters/" + matter.id + "/reviews",
            undefined,
            abort.signal,
          ),
          api<Activity[]>(
            F + "/matters/" + matter.id + "/activity",
            undefined,
            abort.signal,
          ),
          api<Proceeding[]>(
            F + "/matters/" + matter.id + "/proceedings",
            undefined,
            abort.signal,
          ),
          api<Delivery[]>(
            F + "/matters/" + matter.id + "/deliveries",
            undefined,
            abort.signal,
          ),
          api<MatterParticipant[]>(
            F + "/matters/" + matter.id + "/participants",
            undefined,
            abort.signal,
          ),
        ])
      : api<{ tasks: Rows["tasks"] }>(F + "/my-day", undefined, abort.signal);
    Promise.all([common, detail])
      .then(([[clients, matters, members], data]) => {
        if (abort.signal.aborted) return;
        const currentMatter =
          matter && matters.find((item) => item.id === matter.id);
        if (
          currentMatter &&
          matter &&
          currentMatter.responsible_identity_id !==
            matter.responsible_identity_id
        )
          setMatter(currentMatter);
        if (Array.isArray(data)) {
          const [
            documents,
            tasks,
            drafts,
            reviews,
            activity,
            proceedings,
            deliveries,
            participants,
          ] = data as [
            Document[],
            Task[],
            Draft[],
            DraftReview[],
            Activity[],
            Proceeding[],
            Delivery[],
            MatterParticipant[],
          ];
          setRows({
            ...initial,
            clients,
            matters,
            members,
            documents,
            tasks,
            drafts,
            reviews,
            activity,
            proceedings,
            deliveries,
            participants,
          });
        } else
          setRows({ ...initial, clients, matters, members, tasks: data.tasks });
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [session, firm, matter, revision]);
  const F = "/firms/" + firm,
    M = F + "/matters/" + matter?.id;
  const refreshWorkspace = useCallback(() => {
    // Refresh related Core views without unmounting the active collaborative editor.
    void Promise.all([
      api<Draft[]>(M + "/drafts"),
      api<Document[]>(M + "/documents"),
      api<DraftReview[]>(M + "/reviews"),
      api<Task[]>(M + "/tasks"),
      api<Activity[]>(M + "/activity"),
    ])
      .then(([drafts, documents, reviews, tasks, activity]) =>
        setRows((current) => ({
          ...current,
          drafts,
          documents,
          reviews,
          tasks,
          activity,
        })),
      )
      .catch((e) => setError(e.message));
  }, [M]);
  useEffect(() => {
    const changed = () =>
      view === "agenda"
        ? undefined
        : matter && ["workspace","practice"].includes(tab)
          ? refreshWorkspace()
          : refresh();
    window.addEventListener("law-order-work-changed", changed);
    return () => window.removeEventListener("law-order-work-changed", changed);
  }, [view, matter?.id, tab, refreshWorkspace, refresh]);
  const name = session?.identity.display_name ?? "";
  const currentRole = rows.members.find(
    (m) => m.active && m.identity_id === session?.identity.id,
  )?.role;
  const director = currentRole === "ADMINISTRATOR";
  const identityName = (id: string) =>
    id === session?.identity.id
      ? session.identity.display_name
      : (availableProfiles().find((p) => p.id === id)?.display_name ??
        "Profesional del estudio");
  const openAt = (selected: Matter, nextTab: string) => {
    open(selected);
    setTab(
      nextTab === "matter-home"
        ? localMode
          ? "workspace"
          : "documents"
        : nextTab,
    );
  };
  const close = () => {
    setForm("");
    setEditTask(undefined);
    setEditDraft(null);
    refresh();
  };
  const go = (key: string) => {
    if (key === "deadlines") setWorkLanding("deadlines");
    window.scrollTo(0, 0);
    setView(key);
    setMatter(null);
    setForm("");
    setSearch("");
    setClientContext(null);
  };
  const openClient = (client: Client) => {
    window.scrollTo(0, 0);
    setClientContext(client);
    setView("matters");
    setMatter(null);
    setForm("");
    setSearch("");
  };
  const open = (m: Matter) => {
    setWorkspaceNewDocument(0);
    window.scrollTo(0, 0);
    setMatter(m);
    setView("matters");
    setTab(localMode ? "workspace" : "documents");
    setForm("");
    setSearch("");
  };
  async function save(path: string, body: unknown) {
    await api(path, body);
    close();
  }
  async function action(path: string, body: unknown) {
    try {
      setError("");
      await api(path, body);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function login(formData: FormData) {
    const r = await api<{ csrf: string }>("/auth/login", {
      email: formData.get("email"),
      password: formData.get("password"),
    });
    setCsrf(r.csrf);
    const s = await api<Session>("/session");
    setSession(s);
    setFirm(s.firms[0]?.id ?? "");
    setError("");
  }
  const members = rows.members
    .filter(
      (m) =>
        m.active &&
        ["ADMINISTRATOR", "LAWYER"].includes(m.role) &&
        (director || m.identity_id === session?.identity.id) &&
        (!centralEnabled() ||
          accountProfiles().some((p) => p.active && p.id === m.identity_id)),
    )
    .map((m) => (
      <option key={m.id} value={m.identity_id}>
        {identityName(m.identity_id)} · {roleLabel(m.role)}
      </option>
    ));
  const canTask = (task: Task, confirm = false) => {
    const member = rows.members.find(
      (m) => m.active && m.identity_id === session?.identity.id,
    );
    if (
      !member ||
      member.role === "ADMINISTRATION" ||
      (confirm && member.role === "ASSISTANT")
    )
      return false;
    const participants =
      matter?.id === task.matter_id
        ? rows.participants
        : localMode
          ? browserStore().snapshot().tables.participants
          : [];
    const permissions =
      participants.find(
        (p) =>
          p.active &&
          p.matter_id === task.matter_id &&
          p.identity_id === session?.identity.id,
      )?.permissions ?? [];
    return (
      director ||
      (member.role === "LAWYER" &&
        permissions.includes("TASK_WRITE") &&
        task.responsible_identity_id === session?.identity.id)
    );
  };
  const agendaControls = {
    actorId: session?.identity.id ?? "",
    director,
    canModifyTask: (task: Task) =>
      director ||
      (canTask(task) && taskAssigner(task) === session?.identity.id),
    onRequestChange: (task: Task) => {
      setRequestTask(task);
      setForm("direction-request");
    },
    identityName,
    onChanged: refresh,
    canEditTask: (task: Task) => canTask(task),
    canConfirmTask: (task: Task) => canTask(task, true),
    onEdit: (task: Task) => {
      const target = rows.matters.find((m) => m.id === task.matter_id);
      if (!target) return;
      setMatter(target);
      setView("matters");
      setTab("tasks");
      setEditTask(task);
      setForm("task");
    },
  };
  const filtered = <T extends { title?: string; display_name?: string }>(
    list: T[],
  ) => list.filter((r) => matchesSearch(search, r.title, r.display_name));
  const documentTitle = (id: string) =>
    rows.documents.find((d) => d.id === id)?.title ?? "Documento del asunto";
  const visibleDrafts = rows.drafts.filter((d) =>
    matchesSearch(search, documentTitle(d.document_id), status(d.status)),
  );
  const visibleReviews = rows.reviews.filter((r) =>
    matchesSearch(
      search,
      documentTitle(
        rows.drafts.find((d) => d.id === r.draft_id)?.document_id ?? "",
      ),
      identityName(r.reviewer_identity_id),
      status(r.status),
    ),
  );
  const visibleProceedings = rows.proceedings.filter((p) =>
    matchesSearch(search, p.title, p.court, p.number),
  );
  const visibleDeliveries = rows.deliveries.filter((d) =>
    matchesSearch(
      search,
      d.recipient,
      d.kind === "DELIVERY" ? "Entrega" : "Presentación",
    ),
  );
  const forms = () => {
    if (form === "firm")
      return (
        <Form
          title="Crear estudio jurídico"
          onClose={close}
          onSave={async (data) => {
            const f = await api<LawFirm>("/firms", { name: data.get("name") });
            const s = await api<Session>("/session");
            setSession(s);
            setFirm(f.id);
            setClientContext(null);
            setMatter(null);
            close();
          }}
        >
          <Field label="Nombre del estudio sintético" name="name" />
        </Form>
      );
    if (form === "client")
      return (
        <Form
          title="Nuevo cliente"
          onClose={close}
          onSave={async (data) => {
            const client = await api<Client>(F + "/clients", {
              kind: data.get("kind"),
              display_name: data.get("display_name"),
              identification: data.get("identification") || null,
            });
            close();
            openClient(client);
          }}
        >
          <Field label="Tipo" name="kind">
            <option value="ORGANIZATION">Organización</option>
            <option value="PERSON">Persona</option>
          </Field>
          <Field label="Nombre" name="display_name" />
          <Field
            label="Identificación (opcional)"
            name="identification"
            required={false}
          />
        </Form>
      );
    if (form === "member")
      return (
        <Form
          title="Incorporar abogado"
          onClose={close}
          onSave={(data) =>
            save(F + "/memberships", {
              identity_id: data.get("identity_id"),
              role: "LAWYER",
            })
          }
        >
          {localMode ? (
            <Field
              label="Profesional para incorporar"
              name="identity_id"
              value=""
            >
              <option value="">Seleccioná un perfil local</option>
              {accountProfiles()
                .filter(
                (profile) =>
                  !rows.members.some(
                    (member) =>
                      member.active && member.identity_id === profile.id,
                  ),
                )
                .map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name}
                </option>
              ))}
            </Field>
          ) : (
            <Field
              label="ID de identidad verificada en Supabase local"
              name="identity_id"
            />
          )}
          {localMode && !centralEnabled() && (
            <p className="muted wide">
              Se incorpora un perfil de prueba a este estudio local. La revisión
              de borradores requiere un profesional distinto del autor.
            </p>
          )}
        </Form>
      );
    if (form === "matter")
      return (
        <Form
          title="Nuevo asunto"
          onClose={close}
          onSave={async (data) => {
            const created = await api<Matter>(F + "/matters", {
              title: data.get("title"),
              client_id: data.get("client_id"),
              kind: data.get("kind"),
              subject_area: data.get("subject_area"),
              responsible_identity_id: data.get("responsible_identity_id"),
              opened_on: data.get("opened_on"),
              closed_on: null,
            });
            close();
            open(created);
          }}
        >
          <Field label="Título" name="title" />
          <Field label="Cliente" name="client_id" value={clientContext?.id}>
            {rows.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </Field>
          <Field label="Tipo" name="kind">
            <option value="ADVISORY">Consultivo</option>
            <option value="JUDICIAL">Litigioso</option>
            <option value="CONTRACTUAL">Contractual</option>
          </Field>
          <Field label="Área del derecho" name="subject_area">
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
            ].map((area) => (
              <option key={area}>{area}</option>
            ))}
          </Field>
          <Field
            label="Responsable"
            name="responsible_identity_id"
            value={session!.identity.id}
          >
            {members}
          </Field>
          <Field
            label="Fecha de apertura"
            name="opened_on"
            type="date"
            value={new Date().toISOString().slice(0, 10)}
          />
        </Form>
      );
    if (form === "task" || form === "deadline")
      return form === "task" && editTask && !editTask.deadline ? (
        <WorkDialog
          firmId={firm}
          data={
            {
              role: currentRole ?? "",
              team: director,
              matters: rows.matters,
              tasks: rows.tasks,
              requests: [],
              people: rows.members
                .filter(
                  (m) =>
                    m.active &&
                    (director || m.identity_id === session!.identity.id) &&
                    (!centralEnabled() ||
                      accountProfiles().some(
                        (p) => p.active && p.id === m.identity_id,
                      )),
                )
                .map((m) => ({
                  identity_id: m.identity_id,
                  role: m.role,
                  display_name: identityName(m.identity_id),
                })),
            } satisfies WorkBoardData
          }
          task={editTask}
          onClose={close}
          onSaved={close}
          onSchedule={() => setForm("deadline")}
        />
      ) : (
        <DeadlineForm
          key={editTask?.id ?? matter?.id}
          firmId={firm}
          matterId={editTask?.matter_id ?? matter!.id}
          members={rows.members}
          actorId={session!.identity.id}
          identityName={identityName}
          task={editTask}
          initialCategory={form==="deadline"&&!editTask?"JUDICIAL":"INTERNAL"}
          onClose={close}
          onSaved={close}
        />
      );
    if (form === "direction-request")
      return (
        <DirectionRequestForm
          firmId={firm}
          matters={
            requestTask
              ? rows.matters.filter((m) => m.id === requestTask.matter_id)
              : rows.matters
          }
          task={requestTask}
          onClose={close}
          onSaved={close}
        />
      );
    if (form === "document")
      return (
        <Form
          title="Incorporar original"
          onClose={close}
          onSave={async (data) => {
            const file = data.get("file") as File;
            if (file.size === 0 || file.size > 20 * 1024 * 1024)
              throw Error(
                localMode
                  ? "El archivo debe tener entre 1 byte y 20 MB."
                  : "El archivo debe tener entre 1 byte y 20 MiB.",
              );
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (localMode) {
              const { extractDocument } =
                await import("./document-extraction.js");
              const { documentFormat, documentMime } =
                await import("./document-policy.js");
              const extraction = await extractDocument(bytes, file.name);
              const chunks: string[] = [];
              for (let offset = 0; offset < bytes.length; offset += 32768)
                chunks.push(
                  String.fromCharCode(
                    ...bytes.subarray(offset, offset + 32768),
                  ),
                );
              await save(M + "/legal-team/documents", {
                command_id: crypto.randomUUID(),
                synthetic_data: true,
                max_cost_usd: 0,
                files: [
                  {
                    title: data.get("title"),
                    original_base64: btoa(chunks.join("")),
                    original_filename: file.name,
                    mime_type: documentMime[documentFormat(file.name)],
                    extraction,
                  },
                ],
              });
              return;
            }
            new TextDecoder("utf8", { fatal: true }).decode(bytes);
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            await save(M + "/originals", {
              title: data.get("title"),
              original_base64: btoa(binary),
              original_filename: file.name,
              mime_type: "text/plain",
            });
          }}
        >
          <Field label="Título" name="title" />
          <label className="field">
            <span>
              {localMode
                ? "Original PDF, Word (.docx) o TXT"
                : "Original UTF-8 (.txt)"}
            </span>
            <input
              type="file"
              name="file"
              accept={localMode ? ".txt,.pdf,.docx" : ".txt,text/plain"}
              required
            />
          </label>
          <p className="muted">
            {localMode
              ? "El original se conserva completo. La extracción es local; páginas escaneadas o texto ilegible requieren revisión/OCR."
              : "PDF y binarios requieren escáner aprobado. No se habilitan como documentos limpios."}
          </p>
        </Form>
      );
    if (form === "draft")
      return (
        <Form
          title={editDraft ? "Nueva versión del borrador" : "Preparar borrador"}
          onClose={close}
          onSave={(data) =>
            editDraft
              ? save(M + "/drafts/" + editDraft.id + "/versions", {
                  content: data.get("content"),
                  expected_version_id: editDraft.document_version_id,
                })
              : save(M + "/drafts", {
                  title: data.get("title"),
                  content: data.get("content"),
                })
          }
        >
          {!editDraft && <Field label="Título" name="title" />}
          <label className="field wide">
            <span>Contenido de la versión</span>
            <textarea
              name="content"
              aria-label="Contenido de la versión"
              defaultValue={draftText}
              rows={12}
              required
              maxLength={1000000}
            />
          </label>
          <p className="muted">
            Guardar crea una versión. La aprobación anterior no se hereda.
          </p>
        </Form>
      );
    if (form.startsWith("review:")) {
      const d = rows.drafts.find((d) => d.id === form.split(":")[1])!;
      if (!director)
        return (
          <DirectionRequestForm
            firmId={firm}
            matters={rows.matters.filter((m) => m.id === d.matter_id)}
            drafts={[d]}
            initialKind="REVIEW"
            onClose={close}
            onSaved={close}
          />
        );
      const reviewers = rows.members.filter(
        (m) =>
          m.active &&
          m.identity_id !== d.author_identity_id &&
          (m.role === "ADMINISTRATOR" ||
          rows.participants.some(
            (participant) =>
              participant.active &&
              participant.identity_id === m.identity_id &&
              participant.permissions.includes("DRAFT_REVIEW") &&
              participant.permissions.includes("READ"),
            )),
      );
      return (
        <Form
          title="Enviar versión a revisión"
          onClose={close}
          onSave={(data) =>
            save(M + "/drafts/" + d.id + "/reviews", {
              reviewer_identity_id: data.get("reviewer"),
              expected_version_id: d.document_version_id,
              internal_due_at: null,
            })
          }
        >
          <Field label="Revisor distinto del autor" name="reviewer" value="">
            <option value="">Seleccioná un revisor habilitado</option>
            {reviewers.map((m) => (
              <option key={m.id} value={m.identity_id}>
                {identityName(m.identity_id)} ·{" "}
                {m.role === "LAWYER"
                  ? "Abogado"
                  : m.role === "ADMINISTRATOR"
                    ? "Director del despacho"
                    : "Profesional"}
              </option>
            ))}
          </Field>
          {!reviewers.length && (
            <p className="wide">
              Todavía no hay otro profesional con acceso y permiso de revisión
              en este asunto.{" "}
              <button
                type="button"
                onClick={() =>
                  setForm(
                    rows.members.some(
                      (member) =>
                        member.active &&
                        member.identity_id !== d.author_identity_id,
                    )
                      ? "participant"
                      : "member",
                  )
                }
              >
                Configurar revisor
              </button>
            </p>
          )}
          <p className="muted wide">Versión exacta: {d.document_version_id}</p>
        </Form>
      );
    }
    if (form.startsWith("approve:")) {
      const r = rows.reviews.find((r) => r.id === form.split(":")[1])!;
      return (
        <Form
          title="Aprobar esta versión"
          onClose={close}
          onSave={(data) => {
            if (!data.has("confirmed"))
              return Promise.reject(
                Error("Confirmá la revisión de esta versión."),
              );
            return save(M + "/reviews/" + r.id + "/decisions", {
              decision: "APPROVE",
              expected_version_id: r.document_version_id,
              explicitly_confirmed: true,
            });
          }}
        >
          <p className="wide">
            Versión exacta: <code>{r.document_version_id}</code>
          </p>
          <label className="check wide">
            <input name="confirmed" type="checkbox" required /> Revisé el
            contenido y apruebo esta versión.
          </label>
        </Form>
      );
    }
    if (form === "participant")
      return (
        <Form
          title="Conceder acceso al asunto"
          onClose={close}
          onSave={(data) =>
            save(M + "/participants", {
              identity_id: data.get("identity_id"),
              permissions: ["READ", ...data.getAll("permission")],
            })
          }
        >
          <Field label="Miembro del estudio" name="identity_id">
            {members}
          </Field>
          <fieldset className="wide">
            <legend>Permisos explícitos (lectura incluida)</legend>
            {[
              "MANAGE",
              "DOCUMENT_WRITE",
              "TASK_WRITE",
              "DRAFT_WRITE",
              "DRAFT_REVIEW",
            ].map((permission) => (
              <label key={permission} className="check">
                <input type="checkbox" name="permission" value={permission} />
                {{
                  READ: "Ver asunto y documentos",
                  MANAGE: "Administrar el asunto",
                  DOCUMENT_WRITE: "Incorporar documentos",
                  TASK_WRITE: "Gestionar tareas",
                  DRAFT_WRITE: "Editar borradores",
                  DRAFT_REVIEW: "Revisar borradores",
                }[permission] ?? permission}
              </label>
            ))}
          </fieldset>
        </Form>
      );
    if (form === "proceeding")
      return (
        <Form
          title="Agregar procedimiento"
          onClose={close}
          onSave={(d) =>
            save(M + "/proceedings", {
              title: d.get("title"),
              court: d.get("court") || null,
              number: d.get("number") || null,
            })
          }
        >
          <Field label="Descripción" name="title" />
          <Field label="Órgano (opcional)" name="court" required={false} />
          <Field label="Número (opcional)" name="number" required={false} />
        </Form>
      );
    if (form === "delivery")
      return (
        <Form
          title="Registrar acto acreditado"
          onClose={close}
          onSave={(d) =>
            save(M + "/deliveries", {
              document_version_id: d.get("version"),
              kind: d.get("kind"),
              recipient: d.get("recipient"),
              receipt_version_id: d.get("receipt"),
              occurred_at: new Date(String(d.get("date"))).toISOString(),
            })
          }
        >
          <Field label="Tipo de acto" name="kind">
            <option value="DELIVERY">Entrega</option>
            <option value="FILING">Presentación</option>
          </Field>
          <Field label="Versión aprobada (ID exacto)" name="version" />
          <Field label="Destinatario u órgano" name="recipient" />
          <Field label="Versión del comprobante incorporado" name="receipt" />
          <Field label="Fecha del acto" name="date" type="datetime-local" />
        </Form>
      );
    return null;
  };
  if (!session && localMode)
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>LAW & ORDER OS · Local</h1>
          {loading ? (
            <p role="status">Abriendo datos locales…</p>
          ) : (
            <p role="alert">
              {error || "No se pudo abrir el almacenamiento del navegador."}
            </p>
          )}
          <p>
            {centralEnabled()
              ? "Sesión local autenticada. Los datos existentes se conservaron."
              : "Sin autenticación · datos sintéticos. Los datos existentes se conservaron."}
          </p>
          <button onClick={() => location.reload()}>Reintentar</button>
        </section>
      </main>
    );
  if (!session)
    return (
      <main className="login-page">
        <div className="login-brand">
          <span className="brand-mark">L</span>
          <span>
            LAW & ORDER <b>OS</b>
          </span>
        </div>
        <section className="login-card">
          <p className="eyebrow">ESPACIO DE TRABAJO JURÍDICO</p>
          <h1>Ingresar al estudio</h1>
          <p className="muted">
            Desarrollo local · datos sintéticos · IA deshabilitada
          </p>
          {loading ? (
            <p role="status">Comprobando sesión…</p>
          ) : (
            <Form
              title="Sesión de desarrollo"
              onClose={() => setError("")}
              onSave={login}
            >
              <Field
                label="Correo sintético (.invalid)"
                name="email"
                type="email"
              />
              <Field label="Contraseña" name="password" type="password" />
            </Form>
          )}
          <p className="login-note">
            Se requiere Supabase Auth local. No hay acceso por tokens de prueba
            ni cuentas de demostración automáticas.
          </p>
        </section>
      </main>
    );
  const workControl=firm?<WorkManagement key={firm+session.identity.id+workLanding} initialPane={workLanding} firmId={firm} actorId={session.identity.id} director={director} identityName={identityName} search="" onOpen={openAt} onEditDeadline={task=>{agendaControls.onEdit(task);setForm("deadline")}} onCreateDeadline={m=>{open(m);setTab("tasks");setEditTask(undefined);setForm("deadline")}}/>:null;
  const inWorkspace = localMode && matter && tab === "workspace";
  const workspaceView = inWorkspace ? (
      <Suspense fallback={<p role="status">Abriendo workspace…</p>}>
        <WorkspacePanel
          key={matter.id + session.identity.id}
          matter={matter}
          drafts={rows.drafts}
          actor={session.identity.id as "local-administrator" | "local-lawyer"}
          onChanged={refreshWorkspace}
          onNavigate={next=>{if(next==="practice")setPracticeSection("sessions");setTab(next)}}
          newDocumentRequest={workspaceNewDocument}
          requestedDraftId={workspaceRequestedDraft}
          requestedDraftRevision={gabrielWorkspaceRevision}
        onGabriel={() => setGabrielLaunch((value) => value + 1)}
        />
      </Suspense>
    ) : null;
  return (
    <div
      className={
        inWorkspace
          ? "with-document-workspace"
          : "shell" + (collapsed ? " collapsed" : "")
      }
      onClick={(event) => {
        if (!localMode || !(event.target instanceof Element)) return;
        const link = event.target.closest<HTMLAnchorElement>(
          'a[href^="/api/v1/"]',
        );
        if (link) {
          event.preventDefault();
          download(link.getAttribute("href")!.slice("/api/v1".length)).catch(
            (e) => setError(e.message),
          );
        }
      }}
    >
      {inWorkspace ? (
        workspaceView
      ) : (
        <>
          <a className="skip" href="#main">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          title={
            collapsed
              ? "Expandir menú"
              : "Contraer menú · más espacio de trabajo"
          }
          aria-expanded={!collapsed}
          aria-controls="workspace-navigation"
          onClick={() => setCollapsed((current) => !current)}
        >
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
        <div className="logo">
          <span className="brand-mark">L</span>
          {!collapsed && (
            <span>
              LAW & ORDER <b>OS</b>
            </span>
          )}
        </div>
        <nav id="workspace-navigation" aria-label="Navegación principal">
          {nav.filter(([key])=>key!=="finance"||director).map(([key, label]) => (
            <div className="nav-entry" key={key}>
              {["dashboard", "clients", "team", "work", "finance", "admin"].includes(
                key,
              ) &&
                !collapsed && (
                  <div className="workspace-label">
                    {
                      (
                        {
                          dashboard: "TU ESTUDIO",
                          clients: "CLIENTES Y ASUNTOS",
                          team: "ESTUDIO JURÍDICO IA",
                          work: "PRODUCCIÓN",
                          finance: "GESTIÓN ADMINISTRATIVA",
                          admin: "CONFIGURACIÓN",
                        } as Record<string, string>
                      )[key]
                    }
                  </div>
                )}
              <button
                className={view === key ? "nav-item active" : "nav-item"}
                aria-current={view === key ? "page" : undefined}
                aria-label={label}
                title={label}
                onClick={() => go(key)}
              >
                <NavIcon name={key} />
                {!collapsed && <span className="nav-label">{label}</span>}
              </button>
            </div>
          ))}
        </nav>
        {localMode && !centralEnabled() && !collapsed && (
          <div className="local-tools">
            <p>Prueba · sin inicio de sesión</p>
            <button
              onClick={() => {
                try {
                  saveBlob(
                    new Blob([browserStore().exportBackup()], {
                      type: "application/json",
                    }),
                    "law-order-respaldo.json",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Exportar respaldo
            </button>
            <label className="button">
              Importar respaldo
              <input
                aria-label="Importar respaldo"
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={async (event) => {
                  const input = event.currentTarget,
                    file = input.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 256 * 1024 * 1024)
                      throw Error(
                        "El respaldo supera el límite local de 256 MB.",
                      );
                    const raw = await file.text(),
                      state = parseSnapshot(raw);
                    if (
                      !window.confirm(
                        `Reemplazar los datos de este navegador por el respaldo: ${state.tables.lawFirms.length} estudios, ${state.tables.clients.length} clientes y ${state.tables.matters.length} asuntos. Exportá primero el respaldo actual si necesitás conservarlo.`,
                      )
                    )
                      return;
                    await browserStore().importBackup(raw);
                    location.reload();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    input.value = "";
                  }
                }}
              />
            </label>
          </div>
        )}
        <div className="sidebar-bottom">
          <span className="local-dot" />
          {!collapsed && <span>Equipo jurídico local</span>}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <label className="firm-selector">
            <span className="sr-only">Estudio activo</span>
            <select
              value={firm}
              onChange={(e) => {
                setMatter(null);
                setClientContext(null);
                setRows(initial);
                setFirm(e.target.value);
                setForm("");
              }}
            >
              {session.firms.length === 0 && (
                <option value="">Sin estudio</option>
              )}
              {session.firms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <span className="topbar-context">
            PARAGUAY <span>·</span> Estudio jurídico
          </span>
          <span className="topbar-environment">
            <span className="local-dot" />
            {localMode ? "Espacio local" : "Sesión activa"}
          </span>
          {localMode && !centralEnabled() ? (
            <label className="firm-selector">
              <span className="sr-only">Perfil de prueba</span>
              <select
                aria-label="Perfil de prueba"
                value={session.identity.id}
                onChange={(event) => {
                  try {
                    selectLocalProfile(event.target.value);
                    location.reload();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {accountProfiles().map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <span
                className="topbar-user"
                title={"Identidad: " + session.identity.id}
              >
                {name}
                    <small className="work-role">
                      {roleLabel(currentRole)}
                    </small>
              </span>
              <button
                onClick={async () => {
                      if (centralEnabled()) {
                        await signOut();
                        return;
                      }
                  await api("/auth/logout", {});
                  setCsrf("");
                  setSession(null);
                  setRows(initial);
                  setFirm("");
                }}
              >
                Salir
              </button>
            </>
          )}
        </header>
        <main id="main" className="content">
          {(matter || clientContext) && (
            <div className="breadcrumb">
              Estudio <span>/</span>{" "}
              {matter || clientContext
                ? "Clientes"
                : nav.find((n) => n[0] === view)?.[1]}
              {(matter || clientContext) && (
                <>
                  {" "}
                  <span>/</span>{" "}
                  {clientContext?.display_name ??
                    rows.clients.find((c) => c.id === matter?.client_id)
                      ?.display_name ??
                    "Cliente"}{" "}
                  <span>/</span> Asuntos
                </>
              )}
              {matter && (
                <>
                  {" "}
                  <span>/</span> Detalle
                </>
              )}
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>
                {matter
                  ? matter.title
                  : clientContext
                    ? clientContext.display_name
                    : nav.find((n) => n[0] === view)?.[1]}
              </h1>
              <p className="muted">
                {matter
                  ? `${matterKind(matter.kind)} · ${matter.subject_area} · ${status(matter.status)}`
                  : clientContext
                    ? "Asuntos de este cliente · elegí uno o creá un nuevo asunto."
                    : view === "dashboard"
                      ? "Plazos, prioridades y trabajo del despacho."
                      : view === "team"
                        ? "Conocé a los participantes, sus especialidades y cómo trabaja la Junta jurídica."
                        : view === "clients"
                          ? "Elegí un cliente para acceder a sus asuntos, documentos y equipo jurídico."
                          : view === "matters"
                            ? "Todos los asuntos del estudio, vinculados a sus clientes."
                            : view === "admin"
                              ? "Configuración del estudio y del entorno local."
                              : view === "finance"
                                ? "Cuentas por cobrar, cuentas por pagar y honorarios del estudio."
                              : view === "admission"
                                ? "Ingreso de encargos y revisión de conflictos de intereses."
                              : view === "agenda"
                                ? "Calendario del estudio · reuniones, tareas y vencimientos."
                              : view === "deadlines"
                                    ? director
                                      ? "Prioridades, vencimientos y seguimiento de los encargos."
                                      : "Tus encargos, avances y solicitudes a Dirección."
                                : view === "work"
                                  ? "Encargos, borradores y revisión humana de los asuntos a los que tenés acceso."
                                  : view === "library"
                                    ? "Buscá normas y jurisprudencia, consultá sus fuentes y guardá tus referencias."
                                    : view === "day"
                                      ? `${new Intl.DateTimeFormat("es-PY", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Asuncion" }).format(new Date())} · Tu próxima acción, en contexto.`
                                      : "Información del estudio según tus permisos."}
              </p>
            </div>
            <div className="actions">
              {matter ? (
                <>
                  <button onClick={() => setMatter(null)}>
                    Volver a asuntos
                  </button>
                      <button
                        onClick={() => {
                          setEditTask(undefined);
                          setForm("task");
                        }}
                      >
                        Nueva tarea o plazo
                      </button>
                  <button
                    className="primary"
                    onClick={() => {
                      if (localMode) {
                        setTab("workspace");
                        setWorkspaceNewDocument((value) => value + 1);
                        return;
                      }
                      setDraftText("");
                      setForm("draft");
                    }}
                  >
                    {localMode ? "Nuevo documento" : "Preparar borrador"}
                  </button>
                </>
              ) : (
                <>
                  {view === "admin" && (
                    <button onClick={() => setForm("firm")}>
                      Crear estudio
                    </button>
                  )}
                  {firm && view === "clients" && (
                    <><button onClick={()=>go("admission")}>Admisión y conflictos</button>
                    <button
                      className="primary"
                      onClick={() => setForm("client")}
                    >
                      Nuevo cliente
                    </button></>
                  )}
                  {firm && view === "matters" && (
                    <>
                      {clientContext && (
                        <button onClick={() => go("clients")}>
                          Volver a clientes
                        </button>
                      )}
                      {rows.clients.length ? (
                        <button
                          className="primary"
                          onClick={() => setForm("matter")}
                        >
                          Nuevo asunto
                        </button>
                      ) : (
                        <button
                          className="primary"
                          onClick={() => go("clients")}
                        >
                          Crear primero un cliente
                        </button>
                      )}
                    </>
                  )}
                  {firm && view === "day" && (
                    <>
                      <button onClick={() => go("clients")}>
                        Ver clientes
                      </button>
                          <button onClick={() => go("matters")}>
                            Ver asuntos
                          </button>
                    </>
                  )}
                  {firm && view === "work" && (
                    <button
                      className="primary"
                      onClick={() => setGabrielLaunch((value) => value + 1)}
                    >
                      Iniciar encargo con Gabriel →
                    </button>
                  )}
                  {firm && view === "agenda" && (
                    <button onClick={() => go("matters")}>
                      Ver asuntos →
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button onClick={refresh}>Reintentar</button>
            </div>
          )}
          {form && forms()}
          {clientContext && !matter && (
            <ClientSummary client={clientContext} matters={rows.matters} />
          )}
          {view === "deadlines" && firm ? workControl : view === "finance" && firm ? (
            <Suspense fallback={<p role="status">Abriendo finanzas…</p>}><OfficeFinance key={firm+session.identity.id} firm={firm} matters={rows.matters} clients={rows.clients} onOpenDraft={(m,id)=>{open(m);setWorkspaceRequestedDraft(id);}}/></Suspense>
          ) : view === "admission" && firm ? (
            <Suspense fallback={<p role="status">Abriendo admisión…</p>}><MatterAdministration key={firm+session.identity.id} firm={firm} matters={rows.matters} section="admission" onOpenDraft={(m,id)=>{open(m);setWorkspaceRequestedDraft(id);}}/></Suspense>
          ) : view === "agenda" && firm ? (
            <Suspense fallback={<p role="status">Abriendo agenda…</p>}><ClientAppointments key={firm+session.identity.id} firm={firm} actorId={session.identity.id} director={director} clients={rows.clients} matters={rows.matters} members={rows.members} identityName={identityName} onOpenMatter={id=>{const m=rows.matters.find(m=>m.id===id);if(m)openAt(m,"tasks")}}/></Suspense>
          ) : view === "dashboard" && firm ? (
            loading ? (
              <p role="status">Cargando datos autorizados…</p>
            ) : (
              <Suspense fallback={<p role="status">Abriendo Dashboard…</p>}>
                <DirectorDashboard
                  key={firm + session.identity.id}
                  firmId={firm}
                  actorId={session.identity.id}
                  director={director}
                  matters={rows.matters}
                  clients={rows.clients}
                  onWork={() => { go("deadlines"); setWorkLanding("tasks"); }}
                  onDeadlines={()=>go("deadlines")}
                  onAgenda={() => go("agenda")}
                  onMatters={() => go("matters")}
                  onOpen={(selected, nextTab, section) => {
                    open(selected);
                    setPracticeSection(section ?? "admission");
                    setTab(nextTab);
                  }}
                />
              </Suspense>
            )
          ) : view === "team" ? (
            <Suspense
                  fallback={
                    <p role="status">Abriendo presentación del equipo…</p>
                  }
            >
              <LegalTeamOverview
                onGabriel={() =>
                      firm
                        ? setGabrielLaunch((value) => value + 1)
                        : go("admin")
                }
                onConsultation={() => go("matters")}
              />
            </Suspense>
          ) : view === "library" ? (
            <LegalLibrary />
          ) : !firm && !form && view !== "work" ? (
            <>
                  {view === "admin" && localMode && (
                    <PlatformSettings firm={firm} />
                  )}
              <Empty
                message={
                  localMode
                        ? centralEnabled()
                          ? "Creá el estudio para empezar con tu cuenta personal."
                          : "Creá el estudio para empezar o activá tu cuenta desde Administración."
                    : "Creá el estudio para empezar. La identidad ya está autenticada."
                }
              />
              {view !== "admin" && (
                <button onClick={() => go("admin")}>
                  Ir a Administración para configurar el estudio
                </button>
              )}
            </>
          ) : (
            <>
              {matter && (
                <div
                  className="tabs matter-tabs"
                  role="tablist"
                  aria-label="Secciones del asunto"
                >
                  {[
                    ...(localMode ? [["workspace", "Workspace"]] : []),
                    ["documents", "Documentos"],
                    ["junta", "Consulta jurídica"],
                    ["tasks", "Tareas y plazos"],
                    ["activity", "Actividad"],
                  ].map(([k, l]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={tab === k}
                      onClick={() => {
                        setTab(k!);
                        setSearch("");
                      }}
                    >
                      {l}
                    </button>
                  ))}
                  <details className="case-more"><summary>Más opciones</summary><div>{[
                    ["drafts","Borradores y versiones"],["reviews","Revisión humana"],
                    ["proceedings","Datos del procedimiento"],["participants","Personas y permisos"],
                    ["deliveries","Entregas y presentaciones"],["practice","Sesiones y portal del cliente"],
                  ].map(([key,label])=><button key={key} aria-current={tab===key?"page":undefined} onClick={e=>{if(key==="practice")setPracticeSection("sessions");setTab(key!);setSearch("");e.currentTarget.closest("details")?.removeAttribute("open")}}>{label}</button>)}</div></details>
                </div>
              )}
              <section
                className={
                  "data-panel" +
                  (matter && tab === "junta" ? " junta-workspace" : "") +
                      (matter && tab === "workspace"
                        ? " document-workspace"
                        : "")
                }
                aria-busy={loading}
              >
                <div className="list-toolbar">
                  <h2>
                    {matter
                      ? (
                          {
                            workspace: "Workspace del asunto",
                            documents: "Documentos y versiones",
                            tasks: "Plan de trabajo",
                            drafts: "Producción jurídica",
                            reviews: "Revisión humana",
                            team: "Conocé al equipo jurídico IA",
                            junta: "Consulta jurídica del asunto",
                            proceedings: "Procedimientos relacionados",
                            participants: "Participación y permisos",
                            deliveries: "Actos acreditados",
                            activity: "Historial del asunto",
                            practice: "Sesiones y portal del cliente",
                          } as Record<string, string>
                        )[tab]
                      : view === "day"
                        ? "Organizá tu jornada"
                        : view === "matters"
                          ? "Cartera de asuntos"
                          : view === "clients"
                            ? "Directorio de clientes"
                            : view === "agenda"
                              ? "Agenda de trabajo"
                              : view === "deadlines"
                                ? "Tareas y plazos del estudio"
                              : view === "work"
                                ? "Bandeja de producción"
                                : "Administración"}
                  </h2>
                  {!(
                    view === "admin" ||
                    (matter &&
                      [
                        "workspace",
                        "team",
                        "junta",
                        "participants",
                        "activity",
                      ].includes(tab))
                  ) && (
                    <label className="search">
                      <span className="sr-only">Filtrar lista</span>
                      <input
                        placeholder={
                          view === "clients"
                            ? "Buscar por nombre o identificación…"
                            : view === "matters" && !matter
                              ? "Buscar asunto, cliente o responsable…"
                              : view === "work"
                                ? "Buscar encargo o documento…"
                                : "Buscar en esta vista…"
                        }
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  )}
                  {matter && tab === "documents" && (
                    <>
                          <a
                            className="button"
                            href={"/api/v1" + M + "/annexes"}
                          >
                        Exportar anexos
                      </a>
                      <button
                        className="primary"
                        onClick={() => setForm("document")}
                      >
                        Incorporar original
                      </button>
                    </>
                  )}
                      {director && matter && tab === "participants" && (
                    <button onClick={() => setForm("participant")}>
                      Conceder acceso
                    </button>
                  )}
                  {matter && tab === "proceedings" && (
                    <button onClick={() => setForm("proceeding")}>
                      Agregar procedimiento
                    </button>
                  )}
                  {matter && tab === "deliveries" && (
                    <button onClick={() => setForm("delivery")}>
                      Registrar acto
                    </button>
                  )}
                </div>
                {loading ? (
                  <div className="loading" role="status">
                    Cargando datos autorizados…
                  </div>
                ) : view === "admin" && !matter ? (
                  <div className="settings-workspace">
                    <section className="settings-section">
                      <span className="settings-icon">
                        <NavIcon name="admin" />
                      </span>
                      <div>
                        <span className="eyebrow">ORGANIZACIÓN ACTIVA</span>
                        <h3>
                          {session.firms.find((f) => f.id === firm)?.name}
                        </h3>
                        <p>
                          Este estudio agrupa sus clientes, asuntos y
                          profesionales.
                        </p>
                        <dl>
                          <div>
                            <dt>Jurisdicción</dt>
                            <dd>Paraguay</dd>
                          </div>
                          <div>
                            <dt>Horario de trabajo</dt>
                            <dd>America/Asuncion</dd>
                          </div>
                        </dl>
                        <button onClick={() => go("clients")}>
                          Ver cartera de clientes →
                        </button>
                      </div>
                    </section>
                    <section className="settings-section">
                      <span className="settings-icon">
                        <NavIcon name="clients" />
                      </span>
                      <div>
                            <span className="eyebrow">
                              PERSONAS DEL ESTUDIO
                            </span>
                        <h3>Equipo y participación</h3>
                        <p>
                              Los accesos a cada asunto se gestionan en Personas
                              y permisos.
                        </p>
                        <div className="member-list">
                              {rows.members
                                .filter(
                                  (m) =>
                                    !centralEnabled() ||
                                    accountProfiles().some(
                                      (p) => p.id === m.identity_id,
                                    ),
                                )
                                .map((m) => (
                            <div key={m.id}>
                                    <strong>
                                      {identityName(m.identity_id)}
                                    </strong>
                              <span>
                                      {roleLabel(m.role)} ·{" "}
                                      {m.active ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                          ))}
                        </div>
                            {director && !centralEnabled() && (
                        <button onClick={() => setForm("member")}>
                          Incorporar abogado
                        </button>
                            )}
                      </div>
                    </section>
                    <PlatformSettings firm={firm} />
                  </div>
                ) : matter ? (
                  tab === "workspace" ? (
                    <Suspense
                      fallback={
                        <p role="status">Abriendo editor del asunto…</p>
                      }
                    >
                      <WorkspacePanel
                        key={matter.id + session.identity.id}
                        matter={matter}
                        drafts={rows.drafts}
                        actor={
                          session.identity.id as
                            "local-administrator" | "local-lawyer"
                        }
                        onChanged={refreshWorkspace}
                          onNavigate={next=>{if(next==="practice")setPracticeSection("sessions");setTab(next)}}
                        newDocumentRequest={workspaceNewDocument}
                      />
                    </Suspense>
                  ) : tab === "practice" ? (
                    <Suspense fallback={<p role="status">Abriendo gestión…</p>}>
                      <PracticePanel key={matter.id+session.identity.id+practiceSection} initialSection={practiceSection==="portal"?"portal":"sessions"} sections={["sessions","portal"]} firm={firm} matter={matter} onChanged={refreshWorkspace} onOpenDraft={(id)=>{setWorkspaceRequestedDraft(id);setGabrielWorkspaceRevision(v=>v+1);setTab("workspace");}} />
                    </Suspense>
                  ) : tab === "team" ? (
                    <Suspense
                      fallback={
                            <p role="status">
                              Abriendo presentación del equipo…
                            </p>
                      }
                    >
                      <LegalTeamOverview
                        inMatter
                            onGabriel={() =>
                              setGabrielLaunch((value) => value + 1)
                            }
                        onConsultation={() => setTab("junta")}
                      />
                    </Suspense>
                  ) : tab === "junta" ? (
                    <Suspense
                      fallback={
                        <p role="status">Abriendo Consulta jurídica…</p>
                      }
                    >
                      <LegalTeam
                        onOpenWorkspace={(draftId) => {
                          setWorkspaceRequestedDraft(draftId);
                          if (!draftId) setWorkspaceNewDocument((value) => value + 1);
                          setGabrielWorkspaceRevision((value) => value + 1);
                          setTab("workspace");
                        }}
                        key={
                          matter.id +
                          session.identity.id +
                          gabrielWorkspaceRevision
                        }
                        matter={matter}
                        documents={rows.documents}
                        drafts={rows.drafts}
                        activeProfessionalIds={rows.members
                          .filter((member) => member.active)
                          .map((member) => member.identity_id)}
                        onManageReviewers={() => setForm("member")}
                        eligibleReviewerIds={rows.participants
                          .filter(
                            (participant) =>
                              participant.active &&
                              participant.permissions.includes("READ") &&
                              participant.permissions.includes(
                                "DRAFT_REVIEW",
                              ) &&
                              rows.members.some(
                                (member) =>
                                  member.active &&
                                  member.identity_id ===
                                    participant.identity_id,
                              ),
                          )
                          .map((participant) => participant.identity_id)}
                            onManageReviewerAccess={() =>
                              setForm("participant")
                            }
                        onRequestReview={(draftId) =>
                          setForm("review:" + draftId)
                        }
                        onOpenReviews={() => {
                          setTab("reviews");
                          setSearch("");
                        }}
                        actorId={session.identity.id}
                        clientName={
                          rows.clients.find(
                            (client) => client.id === matter.client_id,
                          )?.display_name
                        }
                        onDocumentsChanged={(documents) =>
                          setRows((current) => ({ ...current, documents }))
                        }
                        onDraftsChanged={async () => {
                          const [drafts, documents] = await Promise.all([
                            api<Draft[]>(M + "/drafts"),
                            api<Document[]>(M + "/documents"),
                          ]);
                          setRows((current) => ({
                            ...current,
                            drafts,
                            documents,
                          }));
                          return documents;
                        }}
                        responsibleName={
                              matter.responsible_identity_id ===
                              session.identity.id
                            ? session.identity.display_name
                            : (availableProfiles().find(
                                (profile) =>
                                      profile.id ===
                                      matter.responsible_identity_id,
                              )?.display_name ?? "Profesional asignado")
                        }
                        onSaved={refresh}
                      />
                    </Suspense>
                  ) : tab === "documents" ? (
                    <div className="table-scroll">
                      <DataTable>
                        <thead>
                          <tr>
                            <th>Documento</th>
                            <th>Propósito</th>
                            <th>Versión publicada</th>
                            <th>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered(rows.documents).map((d) => (
                            <tr key={d.id}>
                              <td>
                                <strong>{d.title}</strong>
                                <div className="muted">
                                  Incorporado el{" "}
                                  {displayDate(d.created_at, true)}
                                </div>
                              </td>
                              <td>
                                <Badge>
                                  {d.purpose === "DRAFT"
                                    ? "Borrador"
                                    : "Original"}
                                </Badge>
                              </td>
                              <td>
                                {d.current_version_id ? (
                                  <details className="version-reference">
                                    <summary>Disponible</summary>
                                    <code>{d.current_version_id}</code>
                                  </details>
                                ) : (
                                  "Sin publicar"
                                )}
                              </td>
                              <td>
                                {d.current_version_id && (
                                  <a
                                    href={
                                      "/api/v1" +
                                      M +
                                      "/documents/" +
                                      d.id +
                                      "/versions/" +
                                      d.current_version_id +
                                      "/content"
                                    }
                                  >
                                    Descargar versión
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </DataTable>
                      {!rows.documents.length && (
                        <Empty message="Incorporá el primer original o prepará un borrador." />
                      )}
                    </div>
                  ) : tab === "drafts" ? (
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Borrador</th>
                          <th>Estado</th>
                          <th>Versión exacta</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDrafts.map((d) => (
                          <tr key={d.id}>
                            <td>
                              {rows.documents.find(
                                (v) => v.id === d.document_id,
                              )?.title ?? "Borrador"}
                            </td>
                            <td>
                              <Badge>{status(d.status)}</Badge>
                            </td>
                            <td>
                              <details className="version-reference">
                                <summary>Ver referencia</summary>
                                <code>{d.document_version_id}</code>
                              </details>
                            </td>
                            <td>
                              <button
                                onClick={async () => {
                                  try {
                                    const r = await content(
                                      M +
                                        "/documents/" +
                                        d.document_id +
                                        "/versions/" +
                                        d.document_version_id +
                                        "/content",
                                    );
                                    setDraftText(await r.text());
                                    setEditDraft(d);
                                    setForm("draft");
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                Editar
                              </button>
                              {["DRAFT", "CHANGES_REQUESTED"].includes(
                                d.status,
                              ) && (
                                <button
                                  onClick={() => setForm("review:" + d.id)}
                                >
                                  Solicitar revisión
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : tab === "reviews" ? (
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Versión</th>
                          <th>Revisor</th>
                          <th>Estado</th>
                          <th>Decisión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleReviews.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <a
                                href={
                                  "/api/v1" +
                                  M +
                                  "/documents/" +
                                      rows.drafts.find(
                                        (d) => d.id === r.draft_id,
                                      )?.document_id +
                                  "/versions/" +
                                  r.document_version_id +
                                  "/content"
                                }
                              >
                                {r.document_version_id.slice(0, 8)}
                              </a>
                            </td>
                            <td>{identityName(r.reviewer_identity_id)}</td>
                            <td>
                              <Badge>{status(r.status)}</Badge>
                            </td>
                            <td>
                              {r.status === "PENDING" &&
                                r.reviewer_identity_id ===
                                  session.identity.id && (
                                  <>
                                    <button
                                          onClick={() =>
                                            setForm("approve:" + r.id)
                                          }
                                    >
                                      Aprobar versión
                                    </button>
                                    <button
                                      onClick={() =>
                                        action(
                                              M +
                                                "/reviews/" +
                                                r.id +
                                                "/decisions",
                                          {
                                            decision: "REQUEST_CHANGES",
                                            expected_version_id:
                                              r.document_version_id,
                                            explicitly_confirmed: true,
                                          },
                                        )
                                      }
                                    >
                                      Solicitar cambios
                                    </button>
                                  </>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : tab === "activity" ? (
                    <ol className="activity readable-activity">
                      {[...rows.activity]
                        .sort((a, b) =>
                          b.created_at.localeCompare(a.created_at),
                        )
                        .map((a) => (
                          <li key={a.id}>
                            <time dateTime={a.created_at}>
                              {displayDate(a.created_at)}
                              <small>
                                {new Date(a.created_at).toLocaleTimeString(
                                  "es-PY",
                                  {
                                    timeZone: "America/Asuncion",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </small>
                            </time>
                            <div>
                              <strong>{activityLabels[a.action]}</strong>
                              <p>
                                {rows.documents.find(
                                  (d) => d.id === a.resource_id,
                                )?.title ??
                                      rows.tasks.find(
                                        (t) => t.id === a.resource_id,
                                      )?.title ??
                                  rows.proceedings.find(
                                    (p) => p.id === a.resource_id,
                                  )?.title ??
                                  identityName(a.actor_identity_id)}
                              </p>
                              <details>
                                    <summary>
                                      Ver referencia del registro
                                    </summary>
                                <code>{a.resource_id}</code>
                                    {a.version_id && (
                                      <p>Versión: {a.version_id}</p>
                                    )}
                              </details>
                            </div>
                          </li>
                        ))}
                    </ol>
                  ) : tab === "participants" ? (
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Identidad</th>
                          <th>Permisos efectivos</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.members
                          .filter((m) => m.active)
                          .map((m) => {
                            const participant = rows.participants.find(
                              (p) =>
                                p.identity_id === m.identity_id && p.active,
                            );
                            return (
                              <tr key={m.id}>
                                <td>
                                      <strong>
                                        {identityName(m.identity_id)}
                                      </strong>
                                  {m.identity_id ===
                                    matter.responsible_identity_id && (
                                    <div className="muted">
                                      Responsable del asunto
                                    </div>
                                  )}
                                </td>
                                <td>
                                      {m.role === "ADMINISTRATOR" ? (
                                        "Dirección · acceso al estudio"
                                      ) : participant ? (
                                    <div className="permission-list">
                                      {participant.permissions.map((p) => (
                                        <span key={p}>
                                          {permissionLabels[p]}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    "Sin acceso al asunto"
                                  )}
                                </td>
                                <td>
                                      {director &&
                                        m.role !== "ADMINISTRATOR" && (
                                  <button
                                            onClick={() =>
                                              setForm("participant")
                                            }
                                  >
                                    Gestionar acceso
                                  </button>
                                        )}
                                      {director &&
                                        m.role !== "ADMINISTRATOR" &&
                                        participant &&
                                    m.identity_id !==
                                      matter.responsible_identity_id && (
                                      <button
                                        onClick={() =>
                                          action(
                                            M +
                                              "/participants/" +
                                              m.identity_id +
                                              "/revocation",
                                            {},
                                          )
                                        }
                                      >
                                        Revocar
                                      </button>
                                    )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </DataTable>
                  ) : tab === "proceedings" ? (
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Procedimiento</th>
                          <th>Órgano</th>
                          <th>Número</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleProceedings.map((p) => (
                          <tr key={p.id}>
                            <td>{p.title}</td>
                            <td>{p.court ?? "Pendiente"}</td>
                            <td>{p.number ?? "Sin número"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : tab === "deliveries" ? (
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Acto</th>
                          <th>Destinatario</th>
                          <th>Versión aprobada</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDeliveries.map((d) => (
                          <tr key={d.id}>
                            <td>
                              {d.kind === "DELIVERY"
                                ? "Entrega"
                                : "Presentación"}
                            </td>
                            <td>{d.recipient}</td>
                            <td>
                                  <code>
                                    {d.document_version_id.slice(0, 8)}
                                  </code>
                            </td>
                            <td>{date(d.occurred_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : (
                    <TaskAgenda
                      {...agendaControls}
                      tasks={rows.tasks}
                      matters={rows.matters}
                      search={search}
                      onOpen={openAt}
                      onComplete={(t) =>
                        void action(
                          F +
                            "/matters/" +
                            t.matter_id +
                            "/tasks/" +
                            t.id +
                            "/status",
                              {
                                status: "DONE",
                                expected_deadline_revision:
                                  t.deadline?.revision,
                              },
                        )
                      }
                      onBrowse={() => setForm("task")}
                      scope="Plan de trabajo de este asunto"
                    />
                  )
                ) : view === "clients" ? (
                  <ClientDirectory
                    clients={rows.clients}
                    matters={rows.matters}
                    search={search}
                    onOpen={openClient}
                    onCreate={() => setForm("client")}
                    onClearSearch={() => setSearch("")}
                    onOpenMatters={() => go("matters")}
                  />
                ) : view === "matters" ? (
                  <MatterDirectory
                    key={clientContext?.id ?? "all"}
                    matters={rows.matters.filter(
                          (m) =>
                            !clientContext || m.client_id === clientContext.id,
                    )}
                    clients={rows.clients}
                    search={search}
                    identityName={identityName}
                    onOpen={openAt}
                    onCreate={() =>
                          rows.clients.length
                            ? setForm("matter")
                            : go("clients")
                    }
                  />
                ) : view === "work" ? (
                  <>
                    <WorkOverview
                      firmId={firm}
                      actorId={session.identity.id}
                      matters={rows.matters}
                      clients={rows.clients}
                      search={search}
                      identityName={identityName}
                      onOpen={openAt}
                      onStart={() => setGabrielLaunch((value) => value + 1)}
                    />
                    <div className="workflow-guide">
                      <button onClick={() => go("team")}>
                        Conocer al equipo IA y cómo delibera la Junta →
                      </button>
                    </div>
                  </>
                ) : view === "day" ? (
                  <DailyFocus
                    {...agendaControls}
                    firmId={firm}
                    tasks={rows.tasks}
                    matters={rows.matters}
                    search={search}
                    onOpen={openAt}
                    onComplete={(t) =>
                      void action(
                        F +
                          "/matters/" +
                          t.matter_id +
                          "/tasks/" +
                          t.id +
                          "/status",
                            {
                              status: "DONE",
                              expected_deadline_revision: t.deadline?.revision,
                            },
                      )
                    }
                    onBrowse={() => go("matters")}
                    onAgenda={() => go("deadlines")}
                  />
                ) : (
                      <WorkManagement
                    firmId={firm}
                        actorId={session.identity.id}
                        director={director}
                        identityName={identityName}
                    search={search}
                    onOpen={openAt}
                        onEditDeadline={(task) => {
                          agendaControls.onEdit(task);
                          setForm("deadline");
                        }}
                        onCreateDeadline={m=>{open(m);setTab("tasks");setEditTask(undefined);setForm("deadline")}}
                  />
                )}
                {!loading &&
                  matter &&
                  tab === "reviews" &&
                  !rows.reviews.length && (
                    <SectionEmpty
                      title="Todavía sin revisiones"
                      description="La revisión humana se solicita sobre una versión concreta de un borrador. El revisor puede aprobarla o pedir cambios."
                      action="Ver borradores"
                      onAction={() => setTab("drafts")}
                      icon="work"
                    />
                  )}
                {!loading &&
                  matter &&
                  tab === "drafts" &&
                  !rows.drafts.length && (
                    <SectionEmpty
                      title="Prepará el primer borrador"
                      description="Creá un documento de trabajo o continuá el encargo con el equipo jurídico. Después podrás solicitar su revisión humana."
                      action="Preparar borrador"
                      onAction={() => {
                        setDraftText("");
                        setForm("draft");
                      }}
                      icon="work"
                    />
                  )}
                {!loading &&
                  matter &&
                  tab === "proceedings" &&
                  !rows.proceedings.length && (
                    <SectionEmpty
                      title="Sin procedimientos vinculados"
                      description="Registrá el expediente, órgano y número si este asunto tiene una actuación judicial o administrativa."
                      action="Agregar procedimiento"
                      onAction={() => setForm("proceeding")}
                    />
                  )}
                {!loading &&
                  matter &&
                  tab === "deliveries" &&
                  !rows.deliveries.length && (
                    <SectionEmpty
                      title="Todavía sin entregas o presentaciones"
                      description="Registrá una entrega ya realizada con su versión aprobada, destinatario y comprobante. El registro no envía el documento."
                      action="Registrar acto"
                      onAction={() => setForm("delivery")}
                    />
                  )}
                {!loading &&
                  matter &&
                  search.trim() &&
                  (
                    {
                      documents: filtered(rows.documents).length,
                      drafts: visibleDrafts.length,
                      reviews: visibleReviews.length,
                      proceedings: visibleProceedings.length,
                      deliveries: visibleDeliveries.length,
                    } as Record<string, number>
                  )[tab] === 0 && (
                    <SectionEmpty
                      title="Sin coincidencias"
                      description="Probá otra búsqueda para encontrar un registro en esta sección."
                    />
                  )}
                <footer className="panel-footer">
                  <span>
                    {centralEnabled()
                      ? "Acceso por cuenta y permisos del asunto"
                      : localMode
                        ? "Modo de prueba · datos ficticios"
                        : "Acceso por estudio y participación en asunto"}
                  </span>
                  <span>
                    {centralEnabled()
                      ? "Guardado en PostgreSQL local · respaldos en Administración"
                      : localMode
                        ? matter && tab === "workspace"
                          ? "Workspace: servidor local · gestión: este navegador"
                          : "Guardado en este navegador · exportá respaldos"
                        : "Datos persistentes · origen manual"}
                  </span>
                </footer>
              </section>
            </>
          )}
          <footer className="workspace-footer">
            <span>
              {centralEnabled()
                ? "LAW & ORDER OS · Servidor local"
                : "LAW & ORDER OS · Versión de prueba"}
            </span>
            <span>{session.identity.display_name}</span>
          </footer>
        </main>
      </div>
        </>
      )}
      {localMode && firm && (
        <Suspense fallback={null}>
          <GabrielAssistant
            key={firm + session.identity.id}
            firmId={firm}
            actorId={session.identity.id}
            clients={rows.clients}
            matters={rows.matters}
            view={view}
            matter={matter}
            onNavigate={go}
            onOpen={(selected, nextTab, draftId) => {
              setWorkspaceRequestedDraft(draftId);
              setGabrielWorkspaceRevision((value) => value + 1);
              openAt(selected, nextTab);
            }}
            launch={gabrielLaunch}
          />
        </Suspense>
      )}
    </div>
  );
}
