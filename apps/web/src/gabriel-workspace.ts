import type {
  Draft,
  Document,
  Matter,
} from "../../../os-core/src/contracts.js";
import type {
  LocalProfile,
  WorkspaceAccess,
} from "../../../packages/workspace/src/model.js";
import type { WorkspaceJob } from "../../../packages/workspace/src/tasks.js";
import { api } from "./api.js";
import { adoptDraft, workspaceRequest } from "./workspace-api.js";
import { selectedAnalysisLevel } from "./AnalysisLevelPicker.js";

const selectionKey = (firm: string, actor: string) =>
  `law-order.gabriel.document.${firm}.${actor}`;
export function rememberGabrielDocument(
  firm: string,
  actor: string,
  matter: string,
  draft: string,
) {
  try {
    sessionStorage.setItem(
      selectionKey(firm, actor),
      JSON.stringify({ matter_id: matter, draft_id: draft }),
    );
  } catch {
    /* Reading and explicit selection remain available without preferences. */
  }
}
export function gabrielDocumentContext(firm: string, actor: string) {
  try {
    return JSON.parse(
      sessionStorage.getItem(selectionKey(firm, actor)) ?? "null",
    ) as { matter_id: string; draft_id: string } | null;
  } catch {
    return null;
  }
}
type Listed = {
  draft_id: string;
  matter_id: string;
  matter_title: string;
  title: string;
  status: string;
};
type Dependencies = {
  matters?: (firm: string) => Promise<Matter[]>;
  list: (matter: Matter) => Promise<Listed[]>;
  access: (
    matter: Matter,
    draft: string,
    actor: LocalProfile,
  ) => Promise<WorkspaceAccess>;
  request: typeof workspaceRequest;
};
const defaults: Dependencies = {
  matters: (firm) => api<Matter[]>(`/firms/${firm}/matters`),
  list: async (matter) => {
    const path = `/firms/${matter.law_firm_id}/matters/${matter.id}`;
    const [drafts, docs] = await Promise.all([
      api<Draft[]>(path + "/drafts"),
      api<Document[]>(path + "/documents"),
    ]);
    return drafts.map((d) => ({
      draft_id: d.id,
      matter_id: matter.id,
      matter_title: matter.title,
      title:
        docs.find((doc) => doc.id === d.document_id)?.title ??
        "Documento de trabajo",
      status: d.status,
    }));
  },
  access: (matter, draft, actor) =>
    adoptDraft(matter.law_firm_id, matter.id, draft, actor),
  request: workspaceRequest,
};

/** Voice and editor use identical document grants and the same director runtime.
 * Tokens stay in this host and are never returned in model tool outputs. */
export class GabrielWorkspace {
  private running = new Map<string, string>();
  private watchers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    private scope: () => {
      firm: string;
      actor: LocalProfile;
      matters: Matter[];
    },
    private open: (matter: Matter, draft: string) => void,
    private deps: Dependencies = defaults,
    private onResult: (result: Record<string, unknown>) => void = () => {},
  ) {}
  dispose() {
    for (const timer of this.watchers.values()) clearTimeout(timer);
    this.watchers.clear();
  }
  private follow(access: WorkspaceAccess, jobId: string) {
    const { firm, actor } = this.scope();
    const poll = async () => {
      if (!this.watchers.has(jobId)) return;
      try {
        const notes = await this.deps.request<{ jobs: WorkspaceJob[] }>(
          `rooms/${access.room.id}/notes`,
          access.token,
        );
        if (!this.watchers.has(jobId)) return;
        const job = notes.jobs.find((j) => j.id === jobId);
        if (job && job.status !== "RUNNING") {
          this.watchers.delete(jobId);
          if (this.scope().firm === firm && this.scope().actor === actor)
            this.onResult({
              job_id: jobId,
              matter_id: access.room.matter_id,
              draft_id: access.room.draft_id,
              status: job.status,
              summary: job.result?.summary,
              error_code: job.error_code,
              has_proposal: !!job.result?.replacement_text,
              quality_control: job.result?.quality_control ?? null,
              document_changed: false,
            });
          return;
        }
        this.watchers.set(
          jobId,
          setTimeout(() => void poll(), 2500),
        );
      } catch {
        if (!this.watchers.has(jobId)) return;
        this.watchers.delete(jobId);
        if (this.scope().firm === firm && this.scope().actor === actor)
          this.onResult({
            job_id: jobId,
            status: "OUTCOME_UNKNOWN",
            document_changed: false,
            error:
              "No se pudo consultar el estado. El encargo no se reenvió; verificá el trabajo guardado.",
          });
      }
    };
    this.watchers.set(
      jobId,
      setTimeout(() => void poll(), 1500),
    );
  }

  async documents() {
    const scope = this.scope();
    const matters = this.deps.matters
      ? await this.deps.matters(scope.firm)
      : scope.matters;
    const results = await Promise.allSettled(
      matters
        .filter((m) => m.law_firm_id === scope.firm)
        .map((m) => this.deps.list(m)),
    );
    const documents = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value : [],
    );
    const remembered = gabrielDocumentContext(scope.firm, scope.actor);
    return {
      documents,
      last_opened:
        documents.find((d) => d.draft_id === remembered?.draft_id) ?? null,
      unavailable_matters: results.filter((r) => r.status === "rejected")
        .length,
      selection_required:
        "Usar IDs del inventario. Si la referencia es ambigua, preguntar qué documento.",
    };
  }
  private async target(args: Record<string, unknown>) {
    const scope = this.scope();
    if (typeof args.matter_id !== "string" || typeof args.draft_id !== "string")
      throw Error("Elegí el documento del inventario antes de consultarlo.");
    const matters = this.deps.matters
      ? await this.deps.matters(scope.firm)
      : scope.matters;
    const matter = matters.find(
      (m) => m.id === args.matter_id && m.law_firm_id === scope.firm,
    );
    if (!matter) throw Error("No hay acceso a ese asunto desde este perfil.");
    const documents = await this.deps.list(matter);
    if (!documents.some((d) => d.draft_id === args.draft_id))
      throw Error(
        "El documento no pertenece al asunto indicado o no está disponible.",
      );
    const access = await this.deps.access(matter, args.draft_id, scope.actor);
    if (
      access.room.matter_id !== matter.id ||
      access.room.law_firm_id !== scope.firm ||
      access.room.draft_id !== args.draft_id
    )
      throw Error("El acceso no corresponde al documento solicitado.");
    return { matter, access };
  }
  async read(args: Record<string, unknown>) {
    const { matter, access } = await this.target(args);
    const result = await this.deps.request<Record<string, unknown>>(
      `rooms/${access.room.id}/director-read`,
      access.token,
      {
        source: args.source,
        job_id: args.job_id ?? null,
        offset: args.offset ?? 0,
        before: args.before ?? null,
      },
    );
    if (args.open === true) {
      rememberGabrielDocument(
        matter.law_firm_id,
        access.actor_id,
        matter.id,
        access.room.draft_id,
      );
      this.open(matter, access.room.draft_id);
    }
    return {
      ...result,
      source_changed: !!access.source_changed,
      read_only: access.read_only,
    };
  }
  async delegate(
    args: Record<string, unknown>,
    conversation: Array<{ role: "user" | "assistant"; content: string }>,
  ) {
    const { matter, access } = await this.target(args);
    if (access.read_only)
      throw Error(
        "El permiso permite leer, pero no encargar trabajo sobre este documento.",
      );
    if (access.source_changed)
      throw Error(
        "Hay versiones distintas del documento. Revisalas antes de encargar cambios.",
      );
    if (typeof args.instruction !== "string" || !args.instruction.trim())
      throw Error("Falta el pedido que debe resolver Gabriel.");
    const read = await this.deps.request<{
      state_hash: string;
      document_size: number;
    }>(`rooms/${access.room.id}/director-read`, access.token, {
      source: "DOCUMENT",
      job_id: null,
      offset: 0,
      before: null,
    });
    const notes = await this.deps.request<{ jobs: WorkspaceJob[] }>(
      `rooms/${access.room.id}/notes`,
      access.token,
    );
    const active = notes.jobs.find((j) => j.status === "RUNNING");
    if (active || this.running.has(access.room.id))
      return {
        status: "RUNNING",
        job_id: active?.id ?? this.running.get(access.room.id),
        document_changed: false,
      };
    const command = crypto.randomUUID();
    this.running.set(access.room.id, command);
    // Persisted by the existing task endpoint. The native voice remains responsive
    // while specialists work; read WORK_INDEX/CONVERSATION to inspect the result.
    let job: WorkspaceJob;
    try {
      job = await this.deps.request<WorkspaceJob>(
        `rooms/${access.room.id}/director-task`,
        access.token,
        {
          command_id: command,
          base_hash: read.state_hash,
          agent_id: "gabriel",
          action: "PLAN",
          workflow_version: 4,
          instruction: args.instruction,
          from: 0,
          to: read.document_size,
          conversation: conversation
            .filter((m) => m.content.trim())
            .slice(-6)
            .map((m) => ({ role: m.role, text: m.content.slice(-1600) })),
          execution_mode: "LIVE",
          include_library: true,
          authorize_paid_calls: true,
          max_cost_usd: 0.6,
          analysis_level: selectedAnalysisLevel(),
        },
      );
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500) throw error;
      return {
        status: "OUTCOME_UNKNOWN",
        job_id: command,
        error: (error as Error).message,
        document_changed: false,
        result:
          "No se confirmó la respuesta del servidor. Consultar este job_id en el trabajo guardado; no reenviar el encargo automáticamente.",
      };
    } finally {
      this.running.delete(access.room.id);
    }
    this.follow(access, job.id);
    return {
      status: job.status,
      job_id: job.id,
      matter_id: matter.id,
      draft_id: access.room.draft_id,
      max_cost_usd: 0.6,
      document_changed: false,
      result:
        "Consultar WORK_INDEX y luego CONVERSATION/PROPOSAL con este job_id. Generar no implica aplicar ni aprobar.",
    };
  }
  async tool(
    name: string,
    args: Record<string, unknown>,
    conversation: Array<{ role: "user" | "assistant"; content: string }>,
  ) {
    try {
      if (name === "workspace_documents") return await this.documents();
      if (name === "read_workspace") return await this.read(args);
      if (name === "delegate_workspace")
        return await this.delegate(args, conversation);
      return { error: "Herramienta de workspace desconocida." };
    } catch (error) {
      return { error: (error as Error).message, document_changed: false };
    }
  }
}
