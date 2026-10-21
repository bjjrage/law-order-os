import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import WorkspaceReview from "./WorkspaceReview.js";
import type { ReviewDecision } from "../../../packages/workspace/src/review.js";
import type { Editor } from "@tiptap/core";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import type {
  WorkspaceAccess,
  DurableReceipt,
} from "../../../packages/workspace/src/model.js";
import {
  receiptCovers,
  textDocument,
} from "../../../packages/workspace/src/model.js";
import {
  type WorkspaceJob,
  type WorkspaceComment,
  type WorkspaceAttachment,
  hasWorkspaceAnalysis,
} from "../../../packages/workspace/src/tasks.js";
import { workspaceRequest } from "./workspace-api.js";
import WorkspaceConversation from "./WorkspaceConversation.js";
import WorkspacePreparedDraft from "./WorkspacePreparedDraft.js";
import { selectedAnalysisLevel } from "./AnalysisLevelPicker.js";
import { takeGabrielRequest } from "./gabriel-request.js";
import {
  reviewKey,
  locateQuote,
  type ReviewAnchor,
} from "../../../packages/workspace/src/review-marks.js";
function editorError(message: string) {
  return (
    (
      {
        WORKSPACE_EDITOR_CLOSED:
          "El editor se cerr\u00f3. Volv\u00e9 a abrir el documento.",
        WORKSPACE_EDITOR_NOT_READY:
          "El documento todav\u00eda se est\u00e1 guardando. Esper\u00e1 la confirmaci\u00f3n del servidor.",
        WORKSPACE_EDITOR_CHANGED:
          "El documento cambi\u00f3 durante la preparaci\u00f3n. Seleccion\u00e1 el texto otra vez.",
        WORKSPACE_ATTACHMENTS_LOADING:
          "Todav\u00eda se est\u00e1n leyendo los originales. Esper\u00e1 un momento.",
      } as Record<string, string>
    )[message] ?? message
  );
}
type Intent = {
  action: "CONSULT" | "ANALYZE" | "REWRITE" | "DRAFT";
  from: number;
  to: number;
  quote: string;
  key: number;
};
export default function WorkspaceAssistant({
  matterId,
  actorId,
  editor,
  access,
  ensureAccess,
  saved,
  panel,
  intent,
  onPanel,
  onClose,
  attachments = [],
  attachmentIssues = [],
  attachmentsLoading = false,
  reviewHost,
}: {
  matterId: string;
  actorId: string;
  reviewHost?: HTMLElement | null;
  attachments?: WorkspaceAttachment[];
  attachmentIssues?: string[];
  attachmentsLoading?: boolean;
  editor: Editor | null;
  access: WorkspaceAccess | null;
  ensureAccess: () => Promise<WorkspaceAccess | undefined>;
  saved: boolean;
  panel: string;
  intent: Intent | null;
  onPanel: (panel: string) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState<Intent["action"]>("CONSULT"),
    [instruction, setInstruction] = useState(""),
    [mode, setMode] = useState("LIVE"),
    [library, setLibrary] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [jobs, setJobs] = useState<WorkspaceJob[]>([]),
    [comments, setComments] = useState<WorkspaceComment[]>([]),
    [comment, setComment] = useState(""),
    [selection, setSelection] = useState<Intent | null>(null),
    [find, setFind] = useState(""),
    [replacement, setReplacement] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const load = () => {
      const queued = takeGabrielRequest(matterId, actorId);
      if (queued) { setInstruction(queued); onPanel("assistant"); }
    };
    load();
    window.addEventListener("law-order-gabriel-request", load);
    return () => window.removeEventListener("law-order-gabriel-request", load);
  }, [matterId, actorId]);
  const [focusedFinding, setFocusedFinding] = useState("");
  const [decisions, setDecisions] = useState<ReviewDecision[]>([]);
  const openedAnalysis = useRef("");
  const openedDraft = useRef("");
  const [draftId, setDraftId] = useState("");
  const [appliedDraftId, setAppliedDraftId] = useState("");
  const openPanel = useRef(onPanel);
  openPanel.current = onPanel;
  const [revision, setRevision] = useState(0);
  const live = useRef({ editor, saved, access });
  live.current = { editor, saved, access };
  const mounted = useRef(true);
  const taskInFlight = useRef(false);
  const accessRef = useRef(access);
  accessRef.current = access;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setSelection(intent);
    if (intent) {
      setAction(intent.action);
      if (intent.action === "ANALYZE")
        setInstruction(
          "Analizá este documento desde los puntos de vista pertinentes para nuestro cliente y proponé alternativas.",
        );
      if (intent.action === "REWRITE")
        setInstruction(
          "Proponé una reformulación de este fragmento conservando obligaciones, condiciones y excepciones.",
        );
      if (intent.action === "DRAFT")
        setInstruction(
          "Quiero redactar un documento. Ayudame a definir qué necesitamos.",
        );
    }
  }, [intent]);
  useEffect(() => {
    setJobs([]);
    setComments([]);
    setSelection(null);
    setFocusedFinding("");
    setDecisions([]);
    openedAnalysis.current = "";
    openedDraft.current = "";
    setDraftId("");
    setAppliedDraftId("");
  }, [access?.room.id]);
  const analysis = jobs.find(
    (j) => j.room_id === access?.room.id && hasWorkspaceAnalysis(j),
  );
  const prepared = jobs.find(
    (j) =>
      j.id === draftId &&
      j.room_id === access?.room.id &&
      j.status === "COMPLETED" &&
      j.result?.replacement_text,
  );
  useEffect(() => {
    if (!appliedDraftId || !prepared || !editor) return;
    const check = () => {
      const proposed =
        prepared.result?.replacement_text?.replace(/\r\n/g, "\n") ?? "";
      if (
        prepared.result?.execution?.scope === "SELECTION"
          ? !locateQuote(editor.state.doc, proposed)
          : editor.state.doc.textBetween(
              0,
              editor.state.doc.content.size,
              "\n",
            ) !== proposed
      )
        setAppliedDraftId("");
    };
    editor.on("update", check);
    return () => {
      editor.off("update", check);
    };
  }, [appliedDraftId, prepared?.id, editor]);
  useEffect(() => {
    const latest = jobs.find(
      (j) =>
        j.room_id === access?.room.id &&
        j.actor_id === access?.actor_id &&
        j.status === "COMPLETED" &&
        (j.request.analysis_job_id || j.result?.execution) &&
        j.result?.replacement_text,
    );
    if (latest && latest.id !== openedDraft.current) {
      openedDraft.current = latest.id;
      setDraftId(latest.id);
      openPanel.current("draft");
    }
  }, [jobs]);
  useEffect(() => {
    if (
      !analysis?.result?.findings.length ||
      openedAnalysis.current === analysis.id
    )
      return;
    openedAnalysis.current = analysis.id;
    if (
      jobs.some(
        (j) =>
          j.status === "COMPLETED" &&
          (j.request.analysis_job_id || j.result?.execution) &&
          j.result?.replacement_text &&
          j.created_at >= analysis.created_at,
      )
    )
      return;
    setFocusedFinding(`${analysis.id}:0`);
    openPanel.current("findings");
  }, [analysis?.id, analysis?.result?.findings.length]);
  const decisionsKey = JSON.stringify(decisions);
  const verifiedLinks = useRef(new Map<string, Editor["state"]["doc"]>());
  useEffect(() => {
    if (
      !editor ||
      editor.isDestroyed ||
      !decisions.some((d) => d.status === "LINKED")
    )
      return;
    const doc = editor.state.doc;
    let active = true;
    void crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(JSON.stringify(doc.toJSON())))
      .then((bytes) => {
        if (!active || editor.isDestroyed || editor.state.doc !== doc) return;
        const hash = Array.from(new Uint8Array(bytes), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        let changed = false;
        for (const d of decisions) {
          const id = `${d.job_id}:${d.finding_index}`;
          if (
            d.status === "LINKED" &&
            d.anchor_hash === hash &&
            verifiedLinks.current.get(id) !== doc
          ) {
            verifiedLinks.current.set(id, doc);
            changed = true;
          }
        }
        if (changed) setRevision((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [editor, decisionsKey, revision]);
  function findingRange(job: WorkspaceJob, index: number) {
    const f = job.result?.findings[index];
    const linked = decisions.find(
      (d) =>
        d.job_id === job.id &&
        d.finding_index === index &&
        d.status === "LINKED",
    );
    if (!editor || editor.isDestroyed || f?.source_id !== "EDITOR") return null;
    const mapped = reviewKey
      .getState(editor.state)
      ?.find((a) => a.id === `${job.id}:${index}`);
    if (
      linked &&
      mapped &&
      editor.state.doc.textBetween(mapped.from, mapped.to, "\n") ===
        linked.quote
    )
      return { from: mapped.from, to: mapped.to };
    if (
      linked &&
      verifiedLinks.current.get(`${job.id}:${index}`) === editor.state.doc &&
      linked.to <= editor.state.doc.content.size &&
      editor.state.doc.textBetween(linked.from, linked.to, "\n") ===
        linked.quote
    )
      return { from: linked.from, to: linked.to };
    return locateQuote(editor.state.doc, linked?.quote ?? f.quote ?? "");
  }
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const anchors: ReviewAnchor[] = [];
    for (const [i, f] of (analysis?.result?.findings ?? []).entries()) {
      if (f.source_id !== "EDITOR") continue;
      const decision = decisions.find(
        (d) => d.job_id === analysis!.id && d.finding_index === i,
      );
      if (decision?.status === "DISMISSED") continue;
      const applied =
        decision?.status === "APPLIED" && f.proposal
          ? locateQuote(editor.state.doc, f.proposal)
          : null;
      const range = applied ?? findingRange(analysis!, i);
      if (range)
        anchors.push({
          id: `${analysis!.id}:${i}`,
          ...range,
          quote: editor.state.doc.textBetween(range.from, range.to, "\n"),
          severity: applied ? "APPLIED" : (f.severity ?? "INFO"),
          number: i + 1,
          active:
            focusedFinding === `${analysis!.id}:${i}` && panel === "findings",
        });
    }
    editor.view.dispatch(editor.state.tr.setMeta(reviewKey, anchors));
    const open = (event: Event) => {
      setFocusedFinding((event as CustomEvent<string>).detail);
      setNotice("");
      setError("");
      openPanel.current("findings");
    };
    const dom = editor.view.dom;
    dom.addEventListener("workspace-review-open", open);
    return () => dom.removeEventListener("workspace-review-open", open);
  }, [editor, analysis?.id, focusedFinding, decisionsKey, revision, panel]);
  useEffect(() => {
    if (!editor) return;
    const update = ({
      transaction,
    }: {
      transaction: { docChanged: boolean; selectionSet: boolean };
    }) => {
      if (transaction.docChanged || transaction.selectionSet)
        setRevision((v) => v + 1);
    };
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);
  async function refresh(a = access) {
    if (!a) return;
    const notes = await workspaceRequest<{
      jobs: WorkspaceJob[];
      comments: WorkspaceComment[];
      decisions: ReviewDecision[];
    }>(`rooms/${a.room.id}/notes`, a.token);
    if (mounted.current && a.room.id === accessRef.current?.room.id) {
      setJobs(notes.jobs);
      setComments(notes.comments);
      setDecisions(notes.decisions ?? []);
    }
  }
  useEffect(() => {
    let active = true;
    const load = () => {
      if (active) void refresh().catch(() => {});
    };
    load();
    const timer = setInterval(load, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [access?.room.id, access?.token]);
  function capture(): Intent {
    if (selection) return selection;
    if (!editor || editor.isDestroyed) throw Error("Abrí un documento.");
    const { from, to } = editor.state.selection;
    const a = action !== "DRAFT" ? 0 : from,
      b = action !== "DRAFT" ? editor.state.doc.content.size : to;
    return {
      action,
      from: a,
      to: b,
      quote: editor.state.doc.textBetween(a, b, "\n"),
      key: Date.now(),
    };
  }
  async function context() {
    const pick = capture();
    if (
      !editor ||
      editor.state.doc.textBetween(pick.from, pick.to, "\n") !== pick.quote
    )
      throw Error(
        "El fragmento cambió. Seleccionalo nuevamente en el documento.",
      );
    if (access && !saved)
      throw Error("Esperá a que termine el guardado antes de enviar.");
    const a = access ?? (await ensureAccess());
    if (!a) throw Error("Primero guardá el documento.");
    // Saving a new composer replaces it with the collaborative editor. Never retain
    // the old Editor across this asynchronous boundary (its manager is destroyed).
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const current = live.current.editor;
      if (
        current &&
        !current.isDestroyed &&
        live.current.access?.room.id === a.room.id &&
        live.current.saved
      )
        break;
      if (!mounted.current) throw Error("WORKSPACE_EDITOR_CLOSED");
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const current = live.current.editor;
    if (!current || current.isDestroyed || !live.current.saved)
      throw Error("WORKSPACE_EDITOR_NOT_READY");
    if (live.current.access?.room.id !== a.room.id)
      throw Error("WORKSPACE_EDITOR_CHANGED");
    const receipt = await workspaceRequest<DurableReceipt>(
      `rooms/${a.room.id}/receipt`,
      a.token,
    );
    if (current.isDestroyed || current !== live.current.editor)
      throw Error("WORKSPACE_EDITOR_CHANGED");
    const doc = current.extensionManager.extensions.find(
      (e) => e.name === "collaboration",
    )?.options.document;
    if (doc && !receiptCovers(receipt, doc))
      throw Error("WORKSPACE_EDITOR_NOT_READY");
    if (
      pick.to > current.state.doc.content.size ||
      current.state.doc.textBetween(pick.from, pick.to, "\n") !== pick.quote
    )
      throw Error("WORKSPACE_EDITOR_CHANGED");
    return { pick, a, receipt };
  }
  async function run(plan?: WorkspaceJob, prompt = instruction) {
    if (plan && plan.request.workflow_version !== 3) {
      await run(undefined, plan.request.instruction);
      return;
    }
    if (taskInFlight.current) return;
    taskInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (attachmentsLoading) throw Error("WORKSPACE_ATTACHMENTS_LOADING");
      if (attachmentIssues.length) throw Error(attachmentIssues.join(" "));
      const { pick: currentPick, a, receipt } = await context();
      const pick = plan
        ? { from: plan.context.from, to: plan.context.to }
        : { from: 0, to: live.current.editor!.state.doc.content.size };
      if (plan && receipt.state_hash !== plan.request.base_hash)
        throw Error(
          "El documento cambió. Presentá el caso otra vez para actualizar el equipo y sus documentos.",
        );
      await workspaceRequest<WorkspaceJob>(`rooms/${a.room.id}/task`, a.token, {
        command_id: crypto.randomUUID(),
        base_hash: receipt.state_hash,
        agent_id: plan ? plan.result!.team_plan!.lead_id : "gabriel",
        // PLAN is the common director entry point, never a UI-selected legal task.
        action: plan ? "ANALYZE" : "PLAN",
        // Offline mode is the explicit legacy fixture; live conversation uses tools.
        workflow_version: plan
          ? plan.request.workflow_version
          : mode === "OFFLINE_TEST"
            ? 3
            : 4,
        ...(plan ? { plan_id: plan.id } : {}),
        ...(!plan && selection?.quote
          ? { selection: { from: currentPick.from, to: currentPick.to } }
          : {}),
        instruction: plan ? plan.request.instruction : prompt,
        from: pick.from,
        to: pick.to,
        execution_mode: plan ? plan.request.execution_mode : mode,
        include_library: plan ? plan.request.include_library : library,
        authorize_paid_calls:
          (plan ? plan.request.execution_mode : mode) === "LIVE",
        max_cost_usd: 0.6,
        analysis_level: plan?.request.analysis_level ?? selectedAnalysisLevel(),
        attachments: plan ? plan.request.attachments : attachments,
      });
      await refresh(a);
      if (accessRef.current?.room.id === a.room.id) {
        if (!plan) setInstruction("");
        setSelection(null);
        setAction("CONSULT");
      }
    } catch (e) {
      setError(editorError((e as Error).message));
    } finally {
      taskInFlight.current = false;
      setBusy(false);
    }
  }
  async function resumeIntegration(job: WorkspaceJob) {
    if (taskInFlight.current) return;
    taskInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { a, receipt } = await context();
      if (
        a.room.id !== job.room_id ||
        receipt.state_hash !== job.request.base_hash
      )
        throw Error(
          "El documento cambió desde el análisis. Revisá los aportes conservados o prepará un análisis de la versión actual.",
        );
      const {
        plan_id: _plan,
        resume_job_id: _resume,
        ...original
      } = job.request;
      await workspaceRequest(`rooms/${a.room.id}/task`, a.token, {
        ...original,
        action: "INTEGRATE",
        resume_job_id: job.id,
        command_id: crypto.randomUUID(),
        authorize_paid_calls: job.request.execution_mode === "LIVE",
      });
      await refresh(a);
      onPanel("assistant");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      taskInFlight.current = false;
      setBusy(false);
    }
  }
  function focusFinding(job: WorkspaceJob, index: number) {
    setNotice("");
    setError("");
    const f = job.result?.findings[index];
    const decision = decisions.find(
      (d) => d.job_id === job.id && d.finding_index === index,
    );
    const range =
      decision?.status === "APPLIED" && editor && f?.proposal
        ? (locateQuote(editor.state.doc, f.proposal) ??
          findingRange(job, index))
        : findingRange(job, index);
    setFocusedFinding(`${job.id}:${index}`);
    if (!range) {
      setNotice(
        "El pasaje no se encuentra de forma única en el texto abierto. Revisá la cita y su documento de origen.",
      );
      return;
    }
    editor!.chain().focus().setTextSelection(range).scrollIntoView().run();
  }
  async function proposeFinding(
    job: WorkspaceJob,
    index: number,
    question = "",
  ) {
    const f = job.result?.findings[index];
    const range = findingRange(job, index);
    if (!range) {
      setError(
        "Seleccioná el pasaje en el documento para pedir una propuesta.",
      );
      return;
    }
    setSelection({
      ...range,
      quote: editor!.state.doc.textBetween(range.from, range.to, "\n"),
      action: question ? "CONSULT" : "REWRITE",
      key: Date.now(),
    });
    setAction(question ? "CONSULT" : "REWRITE");
    setInstruction(
      question
        ? `Sobre este hallazgo: ${f!.title}. ${question}`
        : `Reformulá el fragmento atendiendo este hallazgo: ${f!.title}. ${f!.detail} ${f!.proposal ?? ""}`,
    );
    onPanel("assistant");
  }
  async function applyFinding(job: WorkspaceJob, index: number) {
    if (taskInFlight.current) return;
    if (job.result?.quality_control?.status === "CHANGES_REQUIRED") {
      setError(
        "El análisis tiene errores materiales pendientes. Pedile a Gabriel que los corrija antes de aplicar alternativas.",
      );
      return;
    }
    const f = job.result?.findings[index];
    const range = findingRange(job, index);
    if (!range || !f?.proposal) {
      setError(
        "No se puede localizar esta propuesta de forma única. Seleccioná el pasaje y pedí una nueva versión.",
      );
      return;
    }
    const current = editor!,
      original = current.state.doc.textBetween(range.from, range.to, "\n");
    taskInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let inserted = false;
    try {
      const a = access;
      if (
        !a ||
        a.read_only ||
        job.room_id !== a.room.id ||
        job.status !== "COMPLETED" ||
        !saved
      )
        throw Error(
          "Esperá al guardado del documento o verificá tu permiso de edición.",
        );
      const receipt = await workspaceRequest<DurableReceipt>(
        `rooms/${a.room.id}/receipt`,
        a.token,
      );
      const ydoc = current.extensionManager.extensions.find(
        (e) => e.name === "collaboration",
      )?.options.document;
      if (
        current !== live.current.editor ||
        current.isDestroyed ||
        !ydoc ||
        !receiptCovers(receipt, ydoc) ||
        current.state.doc.textBetween(range.from, range.to, "\n") !== original
      )
        throw Error(
          "El pasaje cambió. Revisá la observación antes de aplicar.",
        );
      // Clause-level review: subsequent accepted changes elsewhere do not invalidate
      // an untouched, uniquely located passage. Generic rewrites retain whole-version guards.
      const undo = yUndoPluginKey.getState(current.state)?.undoManager;
      undo?.stopCapturing();
      current
        .chain()
        .focus()
        .insertContentAt(
          range,
          f.proposal.includes("\n")
            ? (textDocument(f.proposal).content ?? [])
            : { type: "text", text: f.proposal },
        )
        .run();
      undo?.stopCapturing();
      inserted = true;
      setNotice("Cambio insertado; esperando confirmación de guardado…");
      let committed: DurableReceipt | undefined;
      for (const deadline = Date.now() + 15000; Date.now() < deadline;) {
        const r = await workspaceRequest<DurableReceipt>(
          `rooms/${a.room.id}/receipt`,
          a.token,
        );
        if (current !== live.current.editor || current.isDestroyed)
          throw Error("WORKSPACE_EDITOR_CHANGED");
        if (receiptCovers(r, ydoc)) {
          committed = r;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      if (!committed)
        throw Error(
          "El cambio sigue pendiente de guardado. No lo apliques de nuevo; verificá la conexión.",
        );
      const applied = locateQuote(current.state.doc, f.proposal);
      if (!applied)
        throw Error(
          "El texto se guardó, pero no se pudo registrar la decisión de forma única. Revisá el cambio en el documento.",
        );
      await workspaceRequest(`rooms/${a.room.id}/review-decision`, a.token, {
        job_id: job.id,
        finding_index: index,
        status: "APPLIED",
        base_hash: committed.state_hash,
        ...applied,
        quote: current.state.doc.textBetween(applied.from, applied.to, "\n"),
      });
      await refresh(a);
      setNotice("Alternativa aplicada y guardada. Ctrl+Z deshace el texto.");
    } catch (e) {
      setError(
        (inserted ? "El cambio ya fue insertado. " : "") + (e as Error).message,
      );
    } finally {
      taskInFlight.current = false;
      setBusy(false);
    }
  }
  async function decideFinding(
    job: WorkspaceJob,
    index: number,
    status: "LINKED" | "DISMISSED" | "OPEN",
  ) {
    if (taskInFlight.current) return;
    taskInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!editor || !access || access.read_only || !saved)
        throw Error("Esperá al guardado del documento.");
      const current = editor,
        a = access,
        selection = current.state.selection;
      const range =
        status === "LINKED"
          ? { from: selection.from, to: selection.to }
          : { from: 0, to: 0 };
      const quote = current.state.doc.textBetween(range.from, range.to, "\n");
      if (status === "LINKED" && !quote.trim())
        throw Error("Seleccioná la cláusula que querés vincular.");
      const receipt = await workspaceRequest<DurableReceipt>(
        `rooms/${a.room.id}/receipt`,
        a.token,
      );
      const ydoc = current.extensionManager.extensions.find(
        (e) => e.name === "collaboration",
      )?.options.document;
      if (
        current !== live.current.editor ||
        current.isDestroyed ||
        !ydoc ||
        !receiptCovers(receipt, ydoc)
      )
        throw Error("El documento cambió. Esperá al guardado.");
      await workspaceRequest(`rooms/${a.room.id}/review-decision`, a.token, {
        job_id: job.id,
        finding_index: index,
        status,
        base_hash: receipt.state_hash,
        ...range,
        quote,
      });
      await refresh(a);
      setNotice(
        status === "DISMISSED"
          ? "Observación descartada; decisión compartida guardada."
          : status === "LINKED"
            ? "Selección vinculada. Revisá la alternativa antes de aplicarla."
            : "Observación reabierta.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      taskInFlight.current = false;
      setBusy(false);
    }
  }
  async function apply(job: WorkspaceJob) {
    setError("");
    try {
      if (job.result?.quality_control?.status === "CHANGES_REQUIRED")
        throw Error(
          "La propuesta tiene errores materiales pendientes. Pedile a Gabriel que los corrija.",
        );
      if (!access || !editor || !saved || access.read_only)
        throw Error("Esperá al guardado del documento.");
      if (job.room_id !== access.room.id || job.status !== "COMPLETED")
        throw Error(
          "Esta propuesta pertenece a otro documento o no terminó de prepararse.",
        );
      const receipt = await workspaceRequest<DurableReceipt>(
        `rooms/${access.room.id}/receipt`,
        access.token,
      );
      if (editor.isDestroyed || editor !== live.current.editor)
        throw Error("WORKSPACE_EDITOR_CHANGED");
      const doc = editor.extensionManager.extensions.find(
        (e) => e.name === "collaboration",
      )?.options.document;
      if (doc && !receiptCovers(receipt, doc))
        throw Error("Esper\u00e1 a que se guarden los cambios.");
      const target = job.result?.execution ?? job.context;
      if (
        receipt.state_hash !== job.request.base_hash ||
        editor.state.doc.textBetween(target.from, target.to, "\n") !==
          target.quote
      )
        throw Error(
          "El documento cambió desde esta propuesta. No la aplicamos sobre una versión distinta. Seleccioná el texto y pedí otra propuesta.",
        );
      const text = job.result?.replacement_text;
      if (!text) return false;
      const undo = yUndoPluginKey.getState(editor.state)?.undoManager;
      undo?.stopCapturing();
      const changed = editor
        .chain()
        .focus()
        .insertContentAt(
          { from: target.from, to: target.to },
          textDocument(text).content ?? [],
        )
        .run();
      undo?.stopCapturing();
      if (!changed)
        throw Error("No se pudo insertar la propuesta en el documento.");
      setNotice("Propuesta aplicada. Podés deshacerla con Ctrl+Z.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function addComment() {
    setBusy(true);
    setError("");
    try {
      const { pick, a, receipt } = await context();
      await workspaceRequest(`rooms/${a.room.id}/comment`, a.token, {
        command_id: crypto.randomUUID(),
        base_hash: receipt.state_hash,
        from: pick.from,
        to: pick.to,
        body: comment,
      });
      setComment("");
      await refresh(a);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function matches() {
    const found: Array<{ from: number; to: number }> = [];
    if (!find || !editor) return found;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      const value = node.text ?? "";
      let index = value.toLowerCase().indexOf(find.toLowerCase());
      while (index >= 0) {
        found.push({ from: pos + index, to: pos + index + find.length });
        index = value
          .toLowerCase()
          .indexOf(find.toLowerCase(), index + Math.max(1, find.length));
      }
    });
    return found;
  }
  const found = matches();
  const latest = jobs.find((j) => j.result)?.result;
  return (
    <>
      {reviewHost &&
        panel === "draft" &&
        prepared &&
        createPortal(
          <WorkspacePreparedDraft
            job={prepared}
            busy={busy || !saved || !!access?.read_only}
            error={error}
            notice={notice}
            applied={appliedDraftId === prepared.id}
            onApply={() => {
              void apply(prepared).then((applied) => {
                if (applied) setAppliedDraftId(prepared.id);
              });
            }}
            onClose={onClose}
          />,
          reviewHost,
        )}
      {reviewHost &&
        panel === "findings" &&
        createPortal(
          <WorkspaceReview
            job={analysis}
            editor={editor}
            range={
              analysis
                ? findingRange(
                    analysis,
                    Math.max(0, Number(focusedFinding.split(":").at(-1)) || 0),
                  )
                : null
            }
            decisions={decisions}
            index={Math.max(0, Number(focusedFinding.split(":").at(-1)) || 0)}
            blocked={busy || !saved || !!access?.read_only}
            error={error}
            notice={notice}
            onSelect={(i) => analysis && focusFinding(analysis, i)}
            onApply={(i) => analysis && void applyFinding(analysis, i)}
            onDecision={(i, status) =>
              analysis && void decideFinding(analysis, i, status)
            }
            onDiscuss={(i, question) =>
              analysis && void proposeFinding(analysis, i, question)
            }
            onPanel={onPanel}
            onClose={onClose}
          />,
          reviewHost,
        )}
      <aside
        className="word-assistant"
        hidden={!panel || ["findings", "draft"].includes(panel)}
        aria-label="Trabajo junto al documento"
      >
        <header>
          <span>
            Gabriel <small> / EQUIPO DEL DOCUMENTO</small>
          </span>
          <button aria-label="Plegar asistente" onClick={onClose}>
            ×
          </button>
        </header>
        <nav aria-label="Panel de trabajo">
          {[
            ["assistant", "Conversación"],
            ["findings", `Hallazgos ${analysis?.result?.findings.length ?? 0}`],
            ["comments", "Comentarios"],
            ["sources", "Fuentes"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={panel === id}
              onClick={() => onPanel(id!)}
            >
              {label}
            </button>
          ))}
        </nav>
        {(error || notice) && (
          <div className="workspace-assistant-notices">
            {error && (
              <div role="alert">
                <p className="error">{error}</p>
                {!!analysis?.result?.findings.length && (
                  <button onClick={() => onPanel("findings")}>
                    Revisar observaciones en el documento →
                  </button>
                )}
              </div>
            )}
            {notice && <p role="status">{notice}</p>}
          </div>
        )}
        <div
          className={
            "word-assistant-body" +
            (["assistant", "findings"].includes(panel)
              ? " is-conversation"
              : "")
          }
        >
          {(panel === "assistant" || panel === "findings") && (
            <WorkspaceConversation
              voiceScope={access?.room.id ?? "new-document"}
              active={panel === "assistant"}
              jobs={jobs}
              instruction={instruction}
              onInstruction={setInstruction}
              mode={mode}
              onMode={setMode}
              library={library}
              onLibrary={setLibrary}
              busy={busy}
              readOnly={!!access?.read_only}
              saved={saved}
              attachments={attachments}
              attachmentsLoading={attachmentsLoading}
              attachmentIssues={attachmentIssues}
              selection={selection?.quote ?? ""}
              rewrite={action === "REWRITE"}
              onClearSelection={() => {
                setSelection(null);
                setAction("CONSULT");
              }}
              onSend={() => void run()}
              onConfirm={(job) => void run(job)}
              onResumeIntegration={(job) => void resumeIntegration(job)}
              onApply={(job) => void apply(job)}
              onPrepareReview={() =>
                void run(
                  undefined,
                  "Prepará una versión completa del documento abierto incorporando los hallazgos y sus alternativas, respetando los descartes y los cambios ya aplicados. Conservá las cláusulas no afectadas e indicá los pendientes.",
                )
              }
              onOpenDraft={(job) => {
                setDraftId(job.id);
                onPanel("draft");
              }}
              onPanel={onPanel}
            />
          )}
          {panel === "comments" && (
            <>
              <h2>Comentarios compartidos</h2>
              <p>
                El comentario conserva el fragmento y su versión. Los cambios
                del texto no borran esa referencia.
              </p>
              {selection && (
                <blockquote>
                  {selection.quote.slice(0, 500) || "Punto de inserción"}
                </blockquote>
              )}
              <textarea
                aria-label="Nuevo comentario"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Dejá una observación para el equipo…"
                maxLength={4000}
              />
              <button
                disabled={busy || !comment.trim() || !!access?.read_only}
                onClick={() => void addComment()}
              >
                Guardar comentario
              </button>
              {comments.map((c) => (
                <article
                  className={"word-comment" + (c.resolved ? " resolved" : "")}
                  key={c.id}
                >
                  <strong>
                    {c.actor_id === "local-administrator"
                      ? "Administrador local"
                      : "Abogado local"}
                  </strong>
                  <blockquote>
                    {c.quote.slice(0, 300) || "Documento"}
                  </blockquote>
                  <p>{c.body}</p>
                  <small>
                    {new Date(c.created_at).toLocaleString("es-PY")}
                  </small>
                  {c.resolved ? (
                    <span> · Resuelto</span>
                  ) : (
                    <button
                      disabled={!!access?.read_only}
                      onClick={async () => {
                        try {
                          await workspaceRequest(
                            `rooms/${access!.room.id}/resolve-comment`,
                            access!.token,
                            { comment_id: c.id },
                          );
                          await refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Resolver
                    </button>
                  )}
                </article>
              ))}
            </>
          )}
          {panel === "sources" && (
            <>
              <h2>Fuentes utilizadas</h2>
              <p>
                Biblioteca local y pasajes recuperados para la última respuesta.
                Una cita coincidente no equivale a validar la conclusión.
              </p>
              {!latest?.sources.length && (
                <p>
                  No hay fuentes recuperadas en esta respuesta. No se presenta
                  como una conclusión jurídica respaldada.
                </p>
              )}
              {latest?.sources.map((source) => (
                <article className="word-result" key={source.source_id}>
                  <strong>{source.title}</strong>
                  {/^https?:\/\//.test(source.url) && (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      Abrir fuente original ↗
                    </a>
                  )}
                  {source.excerpts.map((p) => (
                    <details key={p.passage_id}>
                      <summary>
                        Pasaje {p.page ? `· página ${p.page}` : ""}
                      </summary>
                      <blockquote>{p.text}</blockquote>
                    </details>
                  ))}
                </article>
              ))}
            </>
          )}
          {panel === "search" && (
            <>
              <h2>Buscar y reemplazar</h2>
              <input
                aria-label="Buscar en el documento"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="Texto a buscar"
              />
              <p>{found.length} coincidencias</p>
              <button
                disabled={!found.length}
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .setTextSelection(found[0]!)
                    .scrollIntoView()
                    .run()
                }
              >
                Ir a la primera coincidencia
              </button>
              <input
                aria-label="Reemplazar por"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="Reemplazar por"
              />
              <button
                disabled={!found.length || !!access?.read_only}
                onClick={() => {
                  if (!editor) return;
                  const tr = editor.state.tr;
                  for (const range of [...found].reverse())
                    replacement
                      ? tr.insertText(replacement, range.from, range.to)
                      : tr.delete(range.from, range.to);
                  editor.view.dispatch(tr);
                  setNotice("Reemplazos aplicados. Ctrl+Z para deshacer.");
                }}
              >
                Reemplazar todas
              </button>
            </>
          )}
          {panel === "outline" && (
            <>
              <h2>Esquema del documento</h2>
              {(() => {
                const headings: Array<{
                  pos: number;
                  title: string;
                  level: number;
                }> = [];
                editor?.state.doc.descendants((node, pos) => {
                  if (node.type.name === "heading")
                    headings.push({
                      pos,
                      title: node.textContent,
                      level: node.attrs.level,
                    });
                });
                return headings.length ? (
                  headings.map((h) => (
                    <button
                      className="word-outline-item"
                      style={{ paddingLeft: h.level * 10 }}
                      key={h.pos}
                      onClick={() =>
                        editor
                          ?.chain()
                          .focus()
                          .setTextSelection(h.pos + 1)
                          .scrollIntoView()
                          .run()
                      }
                    >
                      {h.title}
                    </button>
                  ))
                ) : (
                  <p>
                    Aplicá Título 1, 2 o 3 desde Inicio para organizar el
                    documento.
                  </p>
                );
              })()}
            </>
          )}
        </div>
        <footer>Cambios siempre revisables · Ctrl+Z deshace</footer>
      </aside>
    </>
  );
}
