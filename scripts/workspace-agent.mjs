import { directorExecution } from "./workspace-director.mjs";
import {
  specialistCatalog,
  specialistProfile,
  compareEvidenceVersions,
  mergeWorkspaceSources,
} from "./workspace-specialists.mjs";

const descriptions = {
  consult_specialist:
    "Consultar o encargar una tarea de estudio a un especialista concreto, con la misma auditoría y checker del equipo. Elegí especialidad y encargo según el pedido humano.",
  analyze_with_specialists:
    "Ejecutar un análisis con los especialistas que el caso necesite. Gabriel elige las preguntas y el titular. No exige otro botón: el mensaje humano autoriza el trabajo solicitado. No usar si solo pide conversar o modificar lo ya analizado.",
  prepare_document:
    "Preparar una propuesta editable con el responsable elegido. Usa análisis existente si corresponde. proposal_job_id permite continuar una versión propuesta aún no aplicada, una vez leída. No modifica el documento: devuelve una versión para revisión y aplicación humana.",
  read_saved_work:
    "Leer íntegro un mensaje/respuesta, análisis con decisiones humanas, o versión propuesta de este documento. Usalo para continuar trabajos anteriores, incluso tras recargar. No deduzcas que una propuesta se aplicó por haberla preparado.",
  list_saved_work:
    "Consultar el historial de este documento, paginado hacia atrás. before=null empieza por lo más reciente. Devuelve fechas, estados, instrucciones y disponibilidad de propuestas; no depende de los ocho turnos recientes.",
  compare_document_versions:
    "Comparar textualmente dos documentos de este snapshot autorizado por document_id (EDITOR para el texto abierto). Devuelve el tramo diferente completo; no decide qué versión rige.",
};

/** The model chooses tools and their order. The host validates scope and budget.
 * No keyword router, fixed stage progression, or automatic analyst/writer pairing. */
export async function runGabrielConversation(
  job,
  {
    schemas,
    toJSONSchema,
    ask,
    execute,
    readSavedWork,
    progress,
    envelope,
    rules,
    agents,
    toolDescriptions = {},
    manageTool,
    finalize = async (value) => value,
  },
) {
  function strictParameters(value) {
    if (!value || typeof value !== "object") return value;
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(strictParameters);
      else strictParameters(child);
    }
    if (value.type === "object" && value.properties)
      value.required = Object.keys(value.properties);
    return value;
  }
  const tools = Object.entries(schemas).map(([name, schema]) => {
    const { $schema, ...parameters } = toJSONSchema(schema);
    return {
      type: "function",
      name,
      description: toolDescriptions[name] ?? descriptions[name],
      parameters: strictParameters(parameters),
      strict: true,
    };
  });
  const instructions = `Sos Gabriel, interlocutor y director del estudio dentro del workspace. Conversá naturalmente en español y atendé el objetivo ACTUAL del humano con el documento y el trabajo anterior. Podés responder, explicar, preguntar algo indispensable, consultar especialistas, encargar análisis y preparar versiones. Las herramientas son capacidades, no pasos obligatorios ni un menú que el humano tenga que elegir. Decidí qué usar y en qué orden según lo solicitado. Si el humano pide varias tareas, realizalas y usá los resultados para continuar hasta atender su pedido. Si solo conversa, respondé sin herramientas. No vuelvas a analizar para incorporar hallazgos existentes. Si necesita una perspectiva concreta, consultá al especialista adecuado; no convoques a todos. El envío autoriza las tareas pedidas dentro del presupuesto indicado; no pidas que pulse otro botón para convocar al equipo. No inventes encargos adicionales ni conviertas una pregunta en una modificación. Las propuestas se revisan junto al documento y su aplicación conserva el control humano. Al terminar, explicá brevemente qué hiciste y qué falta, sin narrar deliberaciones extensas. Si la herramienta falla, no anuncies éxito. Historial, decisiones, resultados y propuestas están disponibles mediante herramientas; leelos cuando el humano se refiera a ellos. Propuesta preparada no significa aplicada. Para ajustar una versión propuesta aún no aplicada, leela y usá su proposal_job_id como base de prepare_document. No inventes identificadores. Catálogo: ${JSON.stringify(agents)}. ${rules}`;
  const messages = [
    {
      role: "user",
      content: JSON.stringify({
        untrusted_workspace: {
          request: job.request.instruction,
          document: job.context.document,
          selection: job.context.selection ?? null,
          attached_documents: job.context.attached_documents ?? [],
          state: job.context.director_state,
        },
      }),
    },
  ];
  let current = structuredClone(job);
  current.context.director_state ??= { analysis: null, recent_jobs: [] };
  const rememberAnalysis = () => {
    const previous = current.context.director_state.analysis;
    if (
      previous &&
      previous.job_id !== job.id &&
      !(current.context.supporting_reviews ?? []).some(
        (r) => r.job_id === previous.job_id,
      )
    ) {
      (current.context.supporting_reviews ??= []).push(previous);
    }
  };
  const trace = [],
    cache = new Map(),
    proposals = new Map();
  let result = {
    ...envelope,
    summary: "",
    findings: [],
    replacement_text: null,
    references: [],
    limitations: [],
    agent_trace: trace,
  };
  const save = async () =>
    progress({ ...result, agent_trace: structuredClone(trace) });
  for (;;) {
    const turn = await ask(
      instructions +
        ` Todo análisis y redacción jurídica debe encargarse a un especialista; vos conversás, coordinás y explicás, sin elaborar un dictamen por tu cuenta. Seleccioná pack_id del catálogo efectivo según la cuestión, no por palabras clave. null usa el paquete base del especialista para compatibilidad. El humano eligió el nivel ${job.request.analysis_level ?? "MEDIO"}: los modelos y el razonamiento se resuelven en el servidor. No cambies el nivel ni el presupuesto. No hay una ruta de junta separada; elegí únicamente las especialidades necesarias. Las objeciones de Santiago y el estado quality_control acompañan cada resultado; no los presentes como certificación jurídica. Catálogo de paquetes: ${JSON.stringify(specialistCatalog)}.`,
      messages,
      tools,
    );
    messages.push(...turn.items);
    if (!turn.calls.length) {
      result.summary = turn.text;
      result.team_progress = {
        active: null,
        completed: result.team_outputs?.map((o) => o.agent_id) ?? [],
      };
      return await finalize(result);
    }
    for (const call of turn.calls) {
      if (!schemas[call.name]) throw Error("WORKSPACE_UNKNOWN_TOOL");
      const args = schemas[call.name].parse(JSON.parse(call.arguments));
      const management = !!toolDescriptions[call.name] && !!manageTool;
      const fingerprint = JSON.stringify([
        call.name,
        args,
        ...(management ? [call.call_id] : []),
      ]);
      let output = cache.get(fingerprint);
      if (!output) {
        const entry = {
          tool: call.name,
          ...(args.agent_id ? { agent_id: args.agent_id } : {}),
          ...(args.instruction ? { instruction: args.instruction } : {}),
          status: "RUNNING",
        };
        trace.push(entry);
        await save();
        try {
          if (management) {
            output = await manageTool(call.name, args, call.call_id);
          } else if (call.name === "compare_document_versions") {
            output = compareEvidenceVersions(
              current.context,
              args.left_id,
              args.right_id,
            );
          } else if (
            call.name === "list_saved_work" ||
            call.name === "read_saved_work"
          ) {
            if (!readSavedWork) throw Error("WORKSPACE_HISTORY_UNAVAILABLE");
            output = await readSavedWork(call.name, args);
            if (call.name === "read_saved_work" && args.part === "ANALYSIS") {
              rememberAnalysis();
              current.context.director_state.analysis = output.analysis;
            }
            if (call.name === "read_saved_work" && args.part === "PROPOSAL")
              proposals.set(args.job_id, output);
          } else {
            let next, execution;
            if (call.name === "analyze_with_specialists") {
              args.participants.forEach((p) =>
                specialistProfile(p.agent_id, p.pack_id),
              );
              const plan = {
                kind: "TEAM",
                reply: args.instruction,
                lead_id: args.lead_id,
                participants: args.participants,
                missing_inputs: [],
                continuation: null,
              };
              if (
                new Set(plan.participants.map((p) => p.agent_id)).size !==
                  plan.participants.length ||
                !plan.participants.some((p) => p.agent_id === plan.lead_id)
              )
                throw Error("WORKSPACE_INVALID_TEAM_PLAN");
              next = {
                ...current,
                request: {
                  ...current.request,
                  action: "ANALYZE",
                  agent_id: plan.lead_id,
                  pack_id:
                    plan.participants.find((p) => p.agent_id === plan.lead_id)
                      ?.pack_id ?? null,
                  instruction: args.instruction,
                },
                context: {
                  ...current.context,
                  quote: current.context.document.text,
                  team_plan: plan,
                },
              };
              result.team_plan = plan;
            } else {
              specialistProfile(args.agent_id, args.pack_id);
              const delegated = directorExecution(current, {
                kind: "CONTINUE",
                continuation: {
                  ...args,
                  action:
                    call.name === "consult_specialist"
                      ? "CONSULT"
                      : args.action,
                },
              });
              next = delegated.job;
              execution = delegated.execution;
              if (args.proposal_job_id) {
                const proposal = proposals.get(args.proposal_job_id);
                if (!proposal?.replacement_text)
                  throw Error("WORKSPACE_PROPOSAL_NOT_READ");
                if (args.scope !== "DOCUMENT" || proposal.scope !== "DOCUMENT")
                  throw Error("WORKSPACE_PROPOSAL_SCOPE_INVALID");
                next.context.text = next.context.quote =
                  proposal.replacement_text;
                next.context.proposal_review = proposal.quality_control ?? null;
              }
            }
            const completed = await execute(next, async (partial) => {
              await progress({
                ...result,
                summary: partial.summary,
                replacement_text:
                  partial.replacement_text ?? result.replacement_text,
                references: partial.references ?? result.references,
                sources: mergeWorkspaceSources(
                  result.sources,
                  partial.sources ?? [],
                ),
                limitations: partial.limitations ?? result.limitations,
                specialist_bindings: [
                  ...(result.specialist_bindings ?? []),
                  ...(partial.specialist_bindings ?? []),
                ],
                quality_control: partial.quality_control,
                ...(execution ? { execution } : {}),
                team_plan: partial.team_plan ?? result.team_plan,
                team_outputs: partial.team_outputs ?? result.team_outputs,
                team_progress: partial.team_progress,
                draft_progress: partial.draft_progress,
                agent_trace: structuredClone(trace),
              });
            });
            result.specialist_bindings = [
              ...(result.specialist_bindings ?? []),
              ...(completed.specialist_bindings ?? []),
            ];
            result.quality_control = completed.quality_control;
            if (call.name === "prepare_document") {
              result = {
                ...result,
                summary: completed.summary,
                replacement_text: completed.replacement_text,
                execution,
                limitations: completed.limitations,
                sources: mergeWorkspaceSources(
                  result.sources,
                  completed.sources,
                ),
                citation_check: completed.citation_check,
              };
              output = {
                job_id: job.id,
                scope: execution.scope,
                summary: completed.summary,
                replacement_text: completed.replacement_text,
                limitations: completed.limitations,
                applied: false,
                quality_control: completed.quality_control,
              };
              proposals.set(job.id, output);
            } else {
              const contributions = completed.team_outputs ?? [
                { agent_id: args.agent_id, ...completed },
              ];
              const findings =
                call.name === "consult_specialist"
                  ? [...result.findings, ...completed.findings]
                  : completed.findings;
              const outputs =
                call.name === "consult_specialist"
                  ? [...(result.team_outputs ?? []), ...contributions]
                  : contributions;
              result = {
                ...result,
                summary: completed.summary,
                findings,
                sources: mergeWorkspaceSources(
                  result.sources,
                  completed.sources,
                ),
                citation_check: completed.citation_check,
                limitations: completed.limitations,
                team_outputs: outputs,
              };
              rememberAnalysis();
              current.context.director_state.analysis = {
                job_id: job.id,
                instruction: args.instruction,
                summary: completed.summary,
                findings: findings.map((f) => ({
                  ...f,
                  decision: "OPEN",
                })),
                sources: completed.sources,
                quality_control: completed.quality_control,
              };
              output = { job_id: job.id, ...completed };
            }
          }
          entry.status = output.ok === false ? "REJECTED" : "COMPLETED";
          entry.summary =
            output.summary ??
            (management
              ? output.ok === false
                ? output.error
                : "Operación del estudio registrada."
              : "Material recuperado.");
          cache.set(fingerprint, output);
        } catch (error) {
          if (
            ![
              "WORKSPACE_HISTORY_NOT_FOUND",
              "WORKSPACE_PROPOSAL_NOT_READ",
              "WORKSPACE_PROPOSAL_SCOPE_INVALID",
              "WORKSPACE_DIRECTOR_BASIS_INVALID",
              "WORKSPACE_DIRECTOR_SCOPE_INVALID",
              "WORKSPACE_REVISION_BASIS_INVALID",
              "WORKSPACE_SPECIALIST_REQUIRED",
              "WORKSPACE_SPECIALIST_PACK_MISMATCH",
              "WORKSPACE_EVIDENCE_NOT_FOUND",
            ].includes(error.message)
          )
            throw error;
          entry.status = "REJECTED";
          entry.summary = error.message;
          output = {
            error: error.message,
            available_analysis_job_id:
              current.context.director_state.analysis?.job_id ?? null,
            has_selection: !!current.context.selection?.quote,
            available_proposals: [...proposals.entries()].map(
              ([job_id, p]) => ({ job_id, scope: p.scope }),
            ),
            guidance:
              "No se ejecutó esta tarea. Leé el trabajo correcto, elegí un alcance válido o pedí el dato indispensable al humano; no anuncies éxito.",
          };
        }
        await save();
      }
      messages.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify({ untrusted_tool_result: output }),
      });
    }
  }
}
