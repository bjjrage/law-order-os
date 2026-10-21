import { it,expect } from 'vitest';
import { prepareIssuePlan } from '../../src/orchestration/issue-plan.js';
import { DEMO_ACTOR } from '../fixtures/index.js';
const plan={study_id:DEMO_ACTOR.study_id,matter_id:'asunto-demo',requested_by:DEMO_ACTOR.user_id,jurisdiction:'PY',as_of_date:'2026-10-12',overall_assignment:'Preparar plan de revisión del expediente',max_total_cost_usd:5,issues:[{legal_question:'¿Qué consta acerca de la notificación cuestionada?',scope:'Solo notificación',max_cost_usd:2}]};
it('prepares a reviewable issue and budget plan without launching boards',()=>{const result=prepareIssuePlan(DEMO_ACTOR,plan);expect(result.approval_status).toBe('PENDING_HUMAN_APPROVAL');expect(result.estimated_max_cost_usd).toBe(2);});
it('rejects issue plans exceeding their approved budget ceiling',()=>{expect(()=>prepareIssuePlan(DEMO_ACTOR,{...plan,max_total_cost_usd:1})).toThrow('ISSUE_PLAN_BUDGET_EXCEEDED');});
