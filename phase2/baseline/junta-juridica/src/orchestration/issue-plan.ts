import { z } from 'zod';
import { assertAccess,BoardError,hash,requireDelimitedQuestion } from '../domain/guards.js';
import { id,date,type AccessContext,type LegalResearchRequest } from '../domain/contracts.js';

export const IssuePlanInputSchema=z.strictObject({study_id:id,matter_id:id,requested_by:id,jurisdiction:id,as_of_date:date,overall_assignment:z.string().min(10),max_total_cost_usd:z.number().finite().positive(),issues:z.array(z.strictObject({legal_question:z.string().min(15),scope:z.string().min(5),max_cost_usd:z.number().finite().positive()})).min(1).max(30)});
export type LegalIssuePlan=z.infer<typeof IssuePlanInputSchema>&{plan_id:string;approval_status:'PENDING_HUMAN_APPROVAL';estimated_max_cost_usd:number};
// The lawyer supplies the proposed issues; preparing a plan never launches boards or calls models.
export function prepareIssuePlan(actor:AccessContext,raw:unknown):LegalIssuePlan{
  const plan=IssuePlanInputSchema.parse(raw);assertAccess(actor,plan,plan.requested_by);
  for(const issue of plan.issues)requireDelimitedQuestion({legal_question:issue.legal_question} as LegalResearchRequest);
  const total=plan.issues.reduce((n,i)=>n+i.max_cost_usd,0);if(total>plan.max_total_cost_usd)throw new BoardError('ISSUE_PLAN_BUDGET_EXCEEDED');
  return {...plan,plan_id:`plan:${hash(plan).slice(0,24)}`,approval_status:'PENDING_HUMAN_APPROVAL',estimated_max_cost_usd:total};
}
