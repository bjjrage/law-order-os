import { z } from 'zod';
import type { BoardRun, StageRecord, Usage } from '../domain/contracts.js';
import { BoardError } from '../domain/guards.js';

export const PriceSchema = z.strictObject({model_id:z.string(),input_per_million_usd:z.number().finite().nonnegative(),output_per_million_usd:z.number().finite().nonnegative(),source:z.string().min(1),as_of_date:z.iso.date(),mode:z.enum(['STANDARD','SIMULATION'])});
export type Price = z.infer<typeof PriceSchema>;
export function tokenCost(price: Price, input: number, output: number): number { return (input*price.input_per_million_usd+output*price.output_per_million_usd)/1e6; }
export function usedBudget(records: StageRecord[]): number { return records.reduce((sum,s)=>sum+(s.token_count_kind==='SIMULATED' ? (s.estimated_cost_usd ?? s.reserved_cost_usd) : (s.actual_cost_usd_if_available ?? s.estimated_cost_usd ?? s.reserved_cost_usd)),0); }
export function reserveBudget(records: StageRecord[], limit: number, price: Price | undefined, input: number, output: number): number {
  if (!price) throw new BoardError('PRICE_SOURCE_REQUIRED');
  const reservation=tokenCost(price,input,output);
  if (usedBudget(records)+reservation>limit+1e-10) throw new BoardError('BUDGET_EXHAUSTED');
  return reservation;
}
export function usageCost(price: Price, usage: Usage): number | null {
  if (usage.input_tokens===null || usage.output_tokens===null) return null;
  return tokenCost(price,usage.input_tokens,usage.output_tokens);
}
export function costReport(run: BoardRun) {
  const unknown=run.stages.filter(s=>s.status!=='BLOCKED' && s.estimated_cost_usd===null && s.actual_cost_usd_if_available===null);
  return {run_id:run.run_id,mode:run.mode,status:run.status,input_tokens:run.stages.reduce((n,s)=>n+(s.input_tokens??0),0),output_tokens:run.stages.reduce((n,s)=>n+(s.output_tokens??0),0),
    token_count_kind:run.mode==='OFFLINE_SIMULATION'?'SIMULATED':run.stages.some(s=>s.input_tokens===null)?'INCOMPLETE':'PROVIDER',
    estimated_total_usd:unknown.length?null:run.stages.reduce((n,s)=>n+(s.estimated_cost_usd??0),0),
    actual_total_usd:run.mode==='OFFLINE_SIMULATION'?0:run.stages.length && run.stages.every(s=>s.actual_cost_usd_if_available!==null)?run.stages.reduce((n,s)=>n+s.actual_cost_usd_if_available!,0):null,
    conservative_budget_used_usd:usedBudget(run.stages),unknown_cost_attempts:unknown.length,latency_ms:run.stages.reduce((n,s)=>n+s.latency_ms,0),
    by_model:Object.fromEntries([...new Set(run.stages.map(s=>s.model_id))].map(model=>[model,{estimated_usd:run.stages.filter(s=>s.model_id===model).some(s=>s.estimated_cost_usd===null)?null:run.stages.filter(s=>s.model_id===model).reduce((n,s)=>n+s.estimated_cost_usd!,0),attempts:run.stages.filter(s=>s.model_id===model).length}])),
  };
}
