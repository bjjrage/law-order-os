/** Human review decisions; these never constitute legal approval of a document. */
export type ReviewDecision = {
  job_id: string;
  finding_index: number;
  status: "LINKED" | "APPLIED" | "DISMISSED" | "OPEN";
  quote: string;
  from: number;
  to: number;
  state_hash: string;
  anchor_hash?: string;
  actor_id: string;
  updated_at: string;
};
