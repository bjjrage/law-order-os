/** Materialize a model decision against the immutable, authorized server snapshot.
 * This validates capabilities and references; it never infers intent from text. */
export function directorExecution(job, plan) {
  const choice = plan.continuation;
  if (plan.kind !== "CONTINUE" || !choice)
    throw Error("WORKSPACE_INVALID_DIRECTOR_DECISION");
  if (
    choice.agent_id === "gabriel" ||
    (["REWRITE", "DRAFT"].includes(choice.action) &&
      choice.agent_id === "santiago")
  )
    throw Error("WORKSPACE_SPECIALIST_REQUIRED");
  const basis = job.context.director_state?.analysis;
  if (choice.analysis_job_id && choice.analysis_job_id !== basis?.job_id)
    throw Error("WORKSPACE_DIRECTOR_BASIS_INVALID");
  const range =
    choice.scope === "SELECTION" ? job.context.selection : job.context.document;
  if (
    !range ||
    range.to < range.from ||
    (choice.scope === "SELECTION" && !range.quote)
  )
    throw Error("WORKSPACE_DIRECTOR_SCOPE_INVALID");
  const quote = choice.scope === "SELECTION" ? range.quote : range.text;
  const {
    team_plan,
    integration_resume,
    director_state,
    document,
    selection,
    review_basis,
    ...snapshot
  } = job.context;
  const execution = {
    scope: choice.scope,
    action: choice.action,
    agent_id: choice.agent_id,
    analysis_job_id: choice.analysis_job_id,
    from: range.from,
    to: range.to,
    quote,
  };
  return {
    execution,
    job: {
      ...job,
      request: {
        ...job.request,
        action: choice.action,
        agent_id: choice.agent_id,
        pack_id: choice.pack_id ?? null,
        instruction: choice.instruction,
        from: range.from,
        to: range.to,
      },
      context: {
        ...snapshot,
        ...(basis ? { available_review: basis } : {}),
        generated_from_director: true,
        proposal_scope: choice.scope,
        text: quote,
        quote,
        from: range.from,
        to: range.to,
        ...(choice.analysis_job_id ? { review_basis: basis } : {}),
      },
    },
  };
}
