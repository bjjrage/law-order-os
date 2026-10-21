import { workspacePrice, workspaceCost } from './workspace-pricing.mjs';
import { workspaceCallFits, workspaceInputTokens } from './workspace-context.mjs';
// Integer nano-dollars; reservations round up and never use floating SQL sums.
const SCALE = 1e9;
function units(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1e5)
    throw Error("WORKSPACE_BUDGET_INVALID_AMOUNT");
  return Math.ceil(value * SCALE);
}
export async function performWorkspaceCall({ provider, call, price, budget, accounts, spend, interaction, tools = false }) {
  const unique = [...new Set(accounts.filter(Boolean))];
  if (!Number.isFinite(budget) || budget < 0 || !unique.length ||
      unique.some(a => !Number.isFinite(a.remaining) || a.remaining < 0)) throw Error("WORKSPACE_BUDGET_INVALID_AMOUNT");
  const available = () => Math.min(budget, ...unique.map(a => a.exhausted ? 0 : a.remaining));
  price = workspacePrice(price, provider.model_id);
  const age = Date.now() - Date.parse(price.as_of_date);
  if (!Number.isFinite(age) || age < 0 || age >= 7 * 86400000) throw Error("PRICE_REVALIDATION_REQUIRED");
  const costFor = (input, output) => {
    return units(workspaceCost(price, input, output)) / SCALE;
  };
  if (costFor(0, call.max_output_tokens) > available()) throw Error("BUDGET_EXHAUSTED");
  let maximum = costFor(call.input_token_upper_bound, call.max_output_tokens);
  if (maximum > available()) maximum = costFor(await (provider.model_id && provider.model_id !== 'deepseek-flash'
    ? workspaceInputTokens(provider, call)
    : provider.countInputTokens(call, AbortSignal.timeout(30000))), call.max_output_tokens);
  if (provider.model_id && !await workspaceCallFits(provider, call)) throw Error('WORKSPACE_MODEL_CONTEXT_EXCEEDED');
  // Re-read *after* countInputTokens yields. Check and debit contain no await.
  if (maximum > available() + 1e-12) throw Error("BUDGET_EXHAUSTED");
  for (const a of unique) a.remaining -= maximum;
  let ticket;
  try { if (spend) ticket = await spend.reserve(interaction, maximum); }
  catch (e) { for (const a of unique) a.remaining += maximum; throw e; }
  let completed;
  try {
    await provider.verifyAvailability(AbortSignal.timeout(15000));
    completed = await (tools ? provider.invokeToolTurn(call, AbortSignal.timeout(120000)) : provider.invoke(call, AbortSignal.timeout(120000)));
  } catch (e) { if (ticket) await spend.unknown(ticket); throw e; }
  const u = completed.usage;
  if ([u?.input_tokens, u?.output_tokens].every(n => Number.isSafeInteger(n) && n >= 0)) {
    const consumed = costFor(u.input_tokens, u.output_tokens);
    if (consumed > maximum) {
      for (const a of unique) { a.remaining -= consumed - maximum; a.exhausted = true; }
      if (ticket) await spend.settle(ticket, consumed);
      throw Error("WORKSPACE_USAGE_EXCEEDS_RESERVATION");
    }
    if (ticket) await spend.settle(ticket, consumed);
    for (const a of unique) a.remaining += maximum - consumed;
  } else if (ticket) await spend.unknown(ticket);
  return completed.output;
}
