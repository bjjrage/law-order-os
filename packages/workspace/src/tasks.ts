import { z } from "zod";
export const workspaceAgents = [
  {
    id: "gabriel",
    name: "Gabriel",
    expertise: "Dirección y consultas rápidas",
  },
  { id: "elena", name: "Elena", expertise: "Civil, contratos y patrimonio" },
  {
    id: "valeria",
    name: "Valeria",
    expertise: "Comercial, sociedades y negocios",
  },
  { id: "lucia", name: "Lucía", expertise: "Trabajo y seguridad social" },
  { id: "martin", name: "Martín", expertise: "Tributario y aduanero" },
  { id: "diego", name: "Diego", expertise: "Penal y delitos económicos" },
  {
    id: "camila",
    name: "Camila",
    expertise: "Constitucional y administrativo",
  },
  {
    id: "santiago",
    name: "Santiago",
    expertise: "Objeciones y revisión adversarial",
  },
] as const;
export const WorkspaceAttachmentSchema = z
  .object({
    document_id: z.uuid(),
    version_id: z.uuid(),
    title: z.string().min(1).max(240),
    text: z.string().min(1).max(60000),
    text_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    original_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    warnings: z.array(z.string().max(600)).max(2000),
  })
  .strict();
export type WorkspaceAttachment = z.infer<typeof WorkspaceAttachmentSchema>;
export const WorkspaceTaskSchema = z
  .object({
    command_id: z.uuid(),
    base_hash: z.string().regex(/^[a-f0-9]{64}$/),
    agent_id: z.enum([
      "gabriel",
      "elena",
      "valeria",
      "lucia",
      "martin",
      "diego",
      "camila",
      "santiago",
    ]),
    action: z.enum([
      "CONSULT",
      "PLAN",
      "ANALYZE",
      "INTEGRATE",
      "REWRITE",
      "DRAFT",
    ]),
    resume_job_id: z.uuid().optional(),
    plan_id: z.uuid().optional(),
    analysis_job_id: z.uuid().optional(),
    pack_id: z.string().min(1).nullable().optional(),
    workflow_version: z
      .union([z.literal(2), z.literal(3), z.literal(4)])
      .optional(),
    analysis_level: z.enum(["AGIL", "MEDIO", "PROFUNDO"]).optional(),
    selection: z
      .object({ from: z.number().int().min(0), to: z.number().int().min(0) })
      .strict()
      .optional(),
    conversation: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().max(1600),
          })
          .strict(),
      )
      .max(6)
      .optional(),
    instruction: z.string().trim().min(1),
    from: z.number().int().min(0),
    to: z.number().int().min(0),
    execution_mode: z.enum(["LIVE", "OFFLINE_TEST"]),
    include_library: z.boolean(),
    authorize_paid_calls: z.boolean(),
    max_cost_usd: z.literal(0.6),
    attachments: z.array(WorkspaceAttachmentSchema).max(12).optional(),
  })
  .strict();
export type WorkspaceTaskInput = z.infer<typeof WorkspaceTaskSchema>;
export const WorkspaceAnswerSchema = z
  .object({
    summary: z.string().min(1).max(12000),
    findings: z
      .array(
        z
          .object({ title: z.string().max(160), detail: z.string().max(2000) })
          .strict(),
      )
      .max(12),
    replacement_text: z.string().max(60000).nullable(),
    references: z
      .array(
        z
          .object({
            source_id: z.string().max(160),
            passage_id: z.string().max(200),
            quote: z.string().max(3000),
          })
          .strict(),
      )
      .max(12),
    limitations: z.array(z.string().max(1000)).max(12),
  })
  .strict();
export type WorkspaceAnswer = z.infer<typeof WorkspaceAnswerSchema>;
export const WorkspaceProviderFailureSchema = z
  .object({
    response_status: z.enum(["incomplete", "failed", "other"]),
    incomplete_reason: z.enum(["max_output_tokens", "content_filter", "other"]),
    max_output_tokens: z.number().int().min(1).max(128000),
    output_tokens: z.number().int().min(0).nullable(),
    reasoning_tokens: z.number().int().min(0).nullable(),
  })
  .strict();
export const WorkspaceAuditSchema = z
  .object({
    outcome: z.enum([
      "NO_MATERIAL_ISSUES_FOUND",
      "CHANGES_REQUIRED",
      "INSUFFICIENT_EVIDENCE",
    ]),
    summary: z.string().min(1).max(1400),
    issues: z
      .array(
        z
          .object({
            target_id: z.string().min(1).max(160),
            severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
            quote: z.string().max(1500),
            problem: z.string().min(1).max(1000),
            requested_change: z.string().min(1).max(1000),
          })
          .strict(),
      )
      .max(30),
    references: WorkspaceAnswerSchema.shape.references,
    limitations: WorkspaceAnswerSchema.shape.limitations,
  })
  .strict();
export type WorkspaceQualityControl = {
  version: "workspace-quality-v1";
  status: "CONTROLLED_DRAFT" | "REVIEW_REQUIRED" | "CHANGES_REQUIRED";
  auditor: "santiago";
  model_id: string;
  audit_attempts?: Array<{
    model_id: string;
    reasoning_effort?: "xhigh";
    fallback_from?: string;
    fallback_reason?: string;
  }>;
  audit: z.infer<typeof WorkspaceAuditSchema>;
  audit_anchors: Array<{ target_id: string; quote_match: boolean }>;
  upstream_controls: Array<{
    target_id: string;
    status: "REVIEW_REQUIRED" | "CHANGES_REQUIRED";
  }>;
  checked_outputs: Array<{ id: string; sha256: string }>;
  reference_checks: Array<{
    output_id: string;
    source_id: string;
    passage_id: string;
    quote_match: boolean;
  }>;
  document_checks: Array<{
    output_id: string;
    source_id: string;
    quote_match: boolean;
  }>;
  detected_references: Array<{ output_id: string; text: string }>;
  identity_verification: "NOT_AUTHENTICATED";
  legal_validity: "HUMAN_REVIEW_REQUIRED";
  limitations: string[];
};
export function workspaceAuditSchemaFor(outputIds: string[]) {
  if (!outputIds.length) throw Error("WORKSPACE_CONTROL_REQUIRED");
  return WorkspaceAuditSchema.extend({
    issues: WorkspaceAuditSchema.shape.issues.element
      .extend({ target_id: z.enum(outputIds as [string, ...string[]]) })
      .array()
      .max(30),
  }).strict();
}
export type WorkspaceSpecialistBinding = {
  agent_id: string;
  pack_id: string;
  pack_label?: string;
  pack_version: number;
  pack_hash: string;
  model_id: string;
  runtime_version: string;
  status: "EXPERIMENTAL_GENERATIVE";
  legal_evaluation: "NOT_ACCREDITED";
  executed_tools: string[];
  evidence_hash: string;
};
export const WorkspaceFailureContextSchema = z
  .object({
    category: z.enum([
      "DATABASE",
      "FILESYSTEM",
      "VALIDATION",
      "PROVIDER",
      "RUNTIME",
    ]),
    error_name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
    native_code: z
      .string()
      .regex(/^[A-Z0-9_]{2,64}$/)
      .nullable(),
    source: z
      .string()
      .regex(
        /^(scripts|apps|packages|junta-juridica|dist)\/[A-Za-z0-9_./-]+\.(mjs|cjs|js|ts|tsx):\d+:\d+$/,
      )
      .nullable(),
    stage: z.enum(["REQUEST", "EXECUTION"]),
  })
  .strict();
export const WorkspaceEditPlanSchema = WorkspaceAnswerSchema.omit({
  findings: true,
  replacement_text: true,
})
  .extend({
    summary: z.string().min(1).max(1400),
    edits: z
      .array(
        z
          .object({
            block_id: z.string().min(1).max(24),
            replacement_text: z.string().max(16000),
          })
          .strict(),
      )
      .max(128),
  })
  .strict();
export const SpecialistIdSchema = z.enum([
  "elena",
  "valeria",
  "lucia",
  "martin",
  "diego",
  "camila",
  "santiago",
]);
export const WorkspacePlanSchema = z
  .object({
    kind: z.enum(["DIRECT", "TEAM", "CLARIFY", "CONTINUE"]),
    reply: z.string().min(1).max(1400),
    lead_id: SpecialistIdSchema.nullable(),
    participants: z
      .array(
        z
          .object({
            agent_id: SpecialistIdSchema,
            pack_id: z.string().min(1).nullable().optional(),
            question: z.string().min(3).max(400),
            reason: z.string().min(3).max(200),
          })
          .strict(),
      )
      .max(6),
    missing_inputs: z.array(z.string().max(250)).max(5),
    continuation: z
      .object({
        action: z.enum(["REWRITE", "DRAFT"]),
        agent_id: WorkspaceTaskSchema.shape.agent_id,
        analysis_job_id: z.uuid().nullable(),
        scope: z.enum(["DOCUMENT", "SELECTION"]),
        instruction: z.string().min(3).max(2000),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();
export type WorkspacePlan = z.infer<typeof WorkspacePlanSchema>;
// Strict model output requires an explicit null for non-continuation decisions.
// Saved v2 plans remain readable through WorkspacePlanSchema.
export const WorkspaceDirectorSchema = WorkspacePlanSchema.extend({
  continuation: WorkspacePlanSchema.shape.continuation.unwrap(),
  participants: WorkspacePlanSchema.shape.participants.element
    .extend({ pack_id: z.string().min(1).nullable() })
    .array()
    .max(6),
}).strict();
export function validTeamPlan(plan: WorkspacePlan) {
  return plan.kind === "TEAM"
    ? plan.participants.length > 0 &&
        !plan.continuation &&
        new Set(plan.participants.map((p) => p.agent_id)).size ===
          plan.participants.length &&
        plan.participants.some((p) => p.agent_id === plan.lead_id)
    : plan.participants.length === 0 &&
        plan.lead_id === null &&
        (plan.kind === "CONTINUE" ? !!plan.continuation : !plan.continuation);
}
export const WorkspaceAnalysisSchema = WorkspaceAnswerSchema.extend({
  summary: z.string().min(1).max(1400),
  findings: z
    .array(
      z
        .object({
          title: z.string().min(1).max(160),
          detail: z.string().min(1).max(800),
          quote: z.string().max(1500),
          source_id: z.string().max(160),
          severity: z.enum(["HIGH", "MEDIUM", "LOW", "INFO"]),
          proposal: z.string().max(2000).nullable(),
        })
        .strict(),
    )
    .max(12),
}).strict();
export type WorkspaceFinding = z.infer<
  typeof WorkspaceAnalysisSchema
>["findings"][number];
export type WorkspaceContribution = z.infer<typeof WorkspaceAnalysisSchema> & {
  agent_id: string;
};
const WorkspaceToolScopeSchema = z
  .enum(["DOCUMENT", "SELECTION"])
  .describe(
    "SELECTION solo si el workspace proporciona un rango seleccionado válido. Para cambiar una cláusula por su contenido sin selección manual, usá DOCUMENT y precisá en instruction qué debe cambiar y qué conservar.",
  );
export const WorkspaceAgentToolSchemas = {
  consult_specialist: z
    .object({
      agent_id: SpecialistIdSchema,
      pack_id: z.string().min(1).nullable().optional(),
      instruction: z.string().trim().min(1),
      scope: WorkspaceToolScopeSchema,
      analysis_job_id: z.uuid().nullable(),
    })
    .strict(),
  analyze_with_specialists: z
    .object({
      instruction: z.string().trim().min(1),
      lead_id: SpecialistIdSchema,
      participants: WorkspacePlanSchema.shape.participants.min(1),
    })
    .strict(),
  prepare_document: z
    .object({
      agent_id: SpecialistIdSchema.exclude(["santiago"]),
      pack_id: z.string().min(1).nullable().optional(),
      instruction: z.string().trim().min(1),
      action: z.enum(["REWRITE", "DRAFT"]),
      scope: WorkspaceToolScopeSchema,
      analysis_job_id: z.uuid().nullable(),
      proposal_job_id: z
        .uuid()
        .nullable()
        .describe(
          "null para el documento abierto. Para ajustar una propuesta aún no aplicada, identificador del trabajo que la generó; leela con read_saved_work(PROPOSAL) antes de preparar su ajuste.",
        ),
    })
    .strict(),
  read_saved_work: z
    .object({
      job_id: z.uuid(),
      part: z.enum(["CONVERSATION", "ANALYSIS", "PROPOSAL"]),
    })
    .strict(),
  list_saved_work: z.object({ before: z.iso.datetime().nullable() }).strict(),
  compare_document_versions: z
    .object({ left_id: z.string().min(1), right_id: z.string().min(1) })
    .strict(),
};
export function isWorkspaceAnalysis(job: WorkspaceJob) {
  return (
    ["ANALYZE", "INTEGRATE"].includes(job.request.action) ||
    (job.request.action === "PLAN" &&
      !!job.result?.agent_trace &&
      !!job.result.team_outputs)
  );
}
export function hasWorkspaceAnalysis(job: WorkspaceJob) {
  return (
    isWorkspaceAnalysis(job) &&
    !!job.result &&
    (job.status === "COMPLETED" ||
      !!job.result.agent_trace?.some(
        (t) =>
          t.status === "COMPLETED" &&
          ["analyze_with_specialists", "consult_specialist"].includes(t.tool),
      ))
  );
}
export type WorkspaceSource = {
  source_id: string;
  title: string;
  url: string;
  excerpts: Array<{ passage_id: string; text: string; page?: number }>;
};
export function canResumeIntegration(job: WorkspaceJob) {
  const plan = job.context.team_plan,
    outputs = job.result?.team_outputs ?? [];
  return (
    job.request.action === "ANALYZE" &&
    job.status === "FAILED" &&
    job.error_code === "WORKSPACE_MODEL_CONTEXT_LIMIT" &&
    job.result?.team_progress?.active === "integration" &&
    !job.result.integration_attempted &&
    !!plan &&
    validTeamPlan(plan) &&
    outputs.length === plan.participants.length &&
    new Set(outputs.map((o) => o.agent_id)).size === outputs.length &&
    plan.participants.every((p) =>
      outputs.some((o) => o.agent_id === p.agent_id),
    )
  );
}
export interface WorkspaceJob {
  id: string;
  room_id: string;
  actor_id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "OUTCOME_UNKNOWN";
  request: WorkspaceTaskInput;
  context: {
    generated_from_director?: boolean;
    proposal_scope?: "DOCUMENT" | "SELECTION";
    available_review?: WorkspaceJob["context"]["review_basis"];
    supporting_reviews?: NonNullable<WorkspaceJob["context"]["review_basis"]>[];
    document?: { text: string; from: number; to: number };
    selection?: { quote: string; from: number; to: number };
    director_state?: {
      analysis: WorkspaceJob["context"]["review_basis"] | null;
      analysis_matches_current_document?: boolean;
      recent_jobs: Array<{
        id: string;
        action: string;
        status: string;
        instruction: string;
        summary: string | null;
        error_code: string | null;
        created_at?: string;
        has_proposal?: boolean;
        proposal_chars?: number;
        limitations?: string[];
        quality_status?: WorkspaceQualityControl["status"];
      }>;
    };
    text: string;
    quote: string;
    from: number;
    to: number;
    title: string;
    matter_title: string;
    attached_documents?: WorkspaceAttachment[];
    team_plan?: WorkspacePlan;
    integration_resume?: {
      outputs: WorkspaceContribution[];
      sources: WorkspaceSource[];
      limitations: string[];
    };
    review_basis?: {
      quality_control?: WorkspaceQualityControl;
      job_id: string;
      summary: string;
      instruction?: string;
      findings: Array<WorkspaceFinding & { decision: string }>;
      sources: WorkspaceSource[];
    };
  };
  result:
    | (Omit<WorkspaceAnswer, "findings"> & {
        findings: Array<
          WorkspaceAnswer["findings"][number] & Partial<WorkspaceFinding>
        >;
        team_plan?: WorkspacePlan;
        agent_trace?: Array<{
          tool: string;
          agent_id?: string;
          instruction?: string;
          status: "RUNNING" | "COMPLETED" | "REJECTED";
          summary?: string;
        }>;
        failure_details?: z.infer<typeof WorkspaceProviderFailureSchema>;
        failure_context?: z.infer<typeof WorkspaceFailureContextSchema>;
        specialist_bindings?: WorkspaceSpecialistBinding[];
        quality_control?: WorkspaceQualityControl;
        execution_profile?: {
          workflow: "legal-unified-v1";
          level: "AGIL" | "MEDIO" | "PROFUNDO";
          analyst_model: string;
          reasoning_effort: string;
          auditor_model: string;
        };
        draft_progress?: { completed_blocks: number; total_blocks: number };
        execution?: {
          scope: "DOCUMENT" | "SELECTION";
          action: "REWRITE" | "DRAFT";
          agent_id: string;
          analysis_job_id: string | null;
          from: number;
          to: number;
          quote: string;
        };
        team_outputs?: Array<{
          agent_id: string;
          summary: string;
          findings: WorkspaceFinding[];
        }>;
        team_progress?: { active: string | null; completed: string[] };
        integration_attempted?: boolean;
        integration_steps?: Array<{
          agent_id: string;
          summary: string;
          findings: WorkspaceFinding[];
        }>;
        simulated: boolean;
        sources: WorkspaceSource[];
        citation_check: Array<{ source_id: string; quote_match: boolean }>;
        semantic_check: "NOT_PERFORMED" | "AI_REVIEWED";
        jev_output: false;
      })
    | null;
  created_at: string;
  error_code: string | null;
  reserved_usd: number;
}
export interface WorkspaceComment {
  id: string;
  actor_id: string;
  base_hash: string;
  quote: string;
  body: string;
  from: number;
  to: number;
  resolved: boolean;
  created_at: string;
}
