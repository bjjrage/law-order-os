import { z } from 'zod';
import { BoardError } from '../domain/guards.js';

export const BoardConfigSchema = z.strictObject({
  max_cost_usd:z.number().finite().positive(), timeout_ms:z.number().int().positive().max(3600000), max_retries:z.number().int().min(0).max(3),
  max_retrievals:z.number().int().min(0).max(10), router_batch_size:z.number().int().min(1).max(100), router_batch_token_limit:z.number().int().positive().max(30000),
  candidate_limit:z.number().int().positive().max(10000), sol_target_input_tokens:z.number().int().positive(), sol_max_input_tokens:z.number().int().min(1).max(100000),
  sol_max_output_tokens:z.number().int().min(25000).max(128000),
  auditor_max_input_tokens:z.number().int().positive().max(1000000),
  auditor_max_output_tokens:z.number().int().positive().max(128000),
});
export type BoardConfig = z.infer<typeof BoardConfigSchema>;
export const DEFAULT_CONFIG: BoardConfig = {max_cost_usd:5,timeout_ms:120000,max_retries:1,max_retrievals:2,router_batch_size:8,router_batch_token_limit:24000,candidate_limit:200,sol_target_input_tokens:50000,sol_max_input_tokens:60000,sol_max_output_tokens:25000,auditor_max_input_tokens:100000,auditor_max_output_tokens:16000};
export function configFromEnv(env: NodeJS.ProcessEnv): BoardConfig {
  if (env.OPENAI_SOL_REASONING_EFFORT && env.OPENAI_SOL_REASONING_EFFORT!=='medium') throw new BoardError('SOL_REQUIRES_MEDIUM');
  return BoardConfigSchema.parse({...DEFAULT_CONFIG,max_cost_usd:Number(env.BOARD_MAX_COST_USD??5),timeout_ms:Number(env.BOARD_TIMEOUT_MS??120000),max_retries:Number(env.BOARD_MAX_RETRIES??1),max_retrievals:Number(env.BOARD_MAX_RETRIEVALS??2),auditor_max_input_tokens:Number(env.BOARD_AUDITOR_MAX_INPUT_TOKENS??DEFAULT_CONFIG.auditor_max_input_tokens),auditor_max_output_tokens:Number(env.BOARD_AUDITOR_MAX_OUTPUT_TOKENS??DEFAULT_CONFIG.auditor_max_output_tokens)});
}
export const EXPECTED_MODELS = {jev:'jev-1.13.0',luna:'gpt-6-luna',sol:'gpt-6.1-sol',gemini:'gemini-3.8-flash'} as const;
export function requiredEnvironment(env: NodeJS.ProcessEnv): { stage: string; status:'BLOCKED'|'NOT_RUN'; reason: string }[] {
  return [['jev','JEV_API_KEY','JEV_MODEL'],['luna','OPENAI_API_KEY','OPENAI_LUNA_MODEL'],['sol','OPENAI_API_KEY','OPENAI_SOL_MODEL'],['gemini','GEMINI_API_KEY','GEMINI_AUDITOR_MODEL']].map(([stage,key,model])=>({stage:stage!,status:env[key!]&&env[model!]?'NOT_RUN':'BLOCKED',reason:env[key!]&&env[model!]?'Configurado; disponibilidad de cuenta no comprobada.':`Falta ${!env[key!]?key:model}.`}));
}
