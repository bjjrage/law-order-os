const tieredModels = new Set(['gpt-6-luna', 'gpt-6.1-sol']);
export function workspacePrice(price, model) {
  const valid = n => Number.isFinite(n) && n >= 0;
  if (!price || !valid(price.input_per_million_usd) || !valid(price.output_per_million_usd)) throw Error('CURRENT_PRICE_REQUIRED');
  const copy = structuredClone(price), tier = copy.long_context;
  if (tieredModels.has(model) && !tier) throw Error('LONG_CONTEXT_PRICE_REQUIRED');
  if (tier && (!Number.isSafeInteger(tier.above_input_tokens) || tier.above_input_tokens < 0 ||
      !valid(tier.input_per_million_usd) || !valid(tier.output_per_million_usd) ||
      tier.input_per_million_usd < copy.input_per_million_usd || tier.output_per_million_usd < copy.output_per_million_usd ||
      tieredModels.has(model) && tier.above_input_tokens !== 272000)) throw Error('LONG_CONTEXT_PRICE_INVALID');
  return copy;
}
export function workspaceCost(price, input, output) {
  if (![input, output].every(n => Number.isSafeInteger(n) && n >= 0)) throw Error('INVALID_INPUT_TOKEN_COUNT');
  const tier = price.long_context && input > price.long_context.above_input_tokens ? price.long_context : price;
  // Whole request changes tariff, including all output and reasoning tokens.
  return (input * tier.input_per_million_usd + output * tier.output_per_million_usd) / 1e6;
}
