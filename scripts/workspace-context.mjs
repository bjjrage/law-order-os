import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Tokenizer } from '@huggingface/tokenizers';

// Exact documented ceilings, not byte thresholds. Unknown models fail closed.
export const workspaceContextLimits = {
  'gpt-6-luna': { input: 922000, context: 1050000, output: 128000 },
  'gpt-6.1-sol': { input: 922000, context: 1050000, output: 128000 },
  'deepseek-flash': { input: 1048576, context: 1048576, output: 393216 },
  'gemini-3.8-flash': { input: 1048576, context: 1048576, output: 65536 },
};
let tokenizer;
const counts = new WeakMap();
export async function deepseekEnvelopeTokens(call) {
  if (!tokenizer) tokenizer = (async () => {
    const base = new URL('../packages/workspace/assets/deepseek-v4-tokenizer/', import.meta.url);
    const provenance = JSON.parse(await readFile(new URL('SOURCE.json', base), 'utf8'));
    const data = {};
    for (const file of provenance.files) {
      if (!['tokenizer.json', 'tokenizer_config.json'].includes(file.path)) throw Error('WORKSPACE_TOKENIZER_FILE_INVALID');
      const bytes = await readFile(new URL(file.path, base));
      if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw Error('WORKSPACE_TOKENIZER_CHANGED');
      data[file.path] = JSON.parse(bytes);
    }
    return new Tokenizer(data['tokenizer.json'], data['tokenizer_config.json']);
  })();
  // Encode the entire serialized request, including schema and metadata, plus
  // framing allowance. This is a LOCAL_TOKENIZER_ENVELOPE, not reported usage.
  // Monetary reservations retain the independent byte upper bound.
  const instance = await tokenizer, text = JSON.stringify(call.payload);
  const encoded = instance.encode(text, { add_special_tokens:false });
  if (instance.decode(encoded.ids, { skip_special_tokens:false, clean_up_tokenization_spaces:false }) !== text)
    throw Error('WORKSPACE_TOKENIZER_ROUNDTRIP_FAILED');
  return encoded.ids.length + 2048;
}
export async function workspaceInputTokens(provider, call) {
  if (!counts.has(call)) counts.set(call, Promise.resolve(provider.model_id === 'deepseek-flash'
    ? deepseekEnvelopeTokens(call)
    : provider.countInputTokens(call, AbortSignal.timeout(30000))));
  const n = await counts.get(call);
  if (!Number.isSafeInteger(n) || n < 0) throw Error('INVALID_INPUT_TOKEN_COUNT');
  return n;
}
export async function workspaceCallFits(provider, call) {
  const limits = workspaceContextLimits[provider.model_id];
  if (!limits) throw Error('WORKSPACE_MODEL_CONTEXT_REQUIRED');
  if (!Number.isSafeInteger(call.input_token_upper_bound) || call.input_token_upper_bound < 0 ||
      !Number.isSafeInteger(call.max_output_tokens) || call.max_output_tokens < 0) throw Error('INVALID_INPUT_TOKEN_COUNT');
  if (call.max_output_tokens > limits.output) return false;
  const capacity = Math.min(limits.input, limits.context - call.max_output_tokens);
  if (call.input_token_upper_bound <= capacity) return true;
  return await workspaceInputTokens(provider, call) <= capacity;
}
