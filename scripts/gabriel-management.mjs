import { createHash } from "node:crypto";
import {
  managementTools,
  managementPolicy,
} from "../dist/os-app/packages/workspace/src/management-tools.js";

// The model chooses tools; the host executes every call under the HTTP session.
export async function managementConversation({
  transport,
  options,
  request,
  policy,
  schema,
  model,
  effort = "low",
  maxOutputTokens = 1400,
  execute,
  reserve,
  requestId,
}) {
  const input = [
    ...request.history,
    {
      role: "user",
      content: JSON.stringify({
        question: request.message,
        current_view: request.view,
        current_context: request.context,
      }),
    },
  ];
  const usage = { input_tokens: 0, output_tokens: 0 };
  const receipts = [],
    seen = new Map();
  let knownUsage = true;
  for (;;) {
    if (options.signal.aborted) throw Error("La respuesta fue interrumpida.");
    const response = await transport("https://api.openai.com/v1/responses", {
      ...options,
      headers: { ...options.headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        service_tier: "default",
        reasoning: { effort },
        max_output_tokens: maxOutputTokens,
        instructions:
          policy.replace(
            "No crees, elimines ni ejecutes nada.",
            "Ejecutá únicamente las herramientas de gestión disponibles, bajo los permisos de la sesión.",
          ) +
          "\n" +
          managementPolicy,
        tools: managementTools,
        parallel_tool_calls: false,
        input,
        text: {
          format: {
            type: "json_schema",
            name: "gabriel_reply",
            strict: true,
            schema,
          },
        },
      }),
    });
    if (!response.ok) return response;
    const result = await response.json();
    if (result.status !== "completed" || result.model !== model)
      throw Error("Gabriel devolvió una respuesta incompleta.");
    if (
      result.service_tier !== "default" ||
      !Number.isInteger(result.usage?.input_tokens) ||
      !Number.isInteger(result.usage?.output_tokens)
    )
      knownUsage = false;
    else {
      usage.input_tokens += result.usage.input_tokens;
      usage.output_tokens += result.usage.output_tokens;
    }
    const calls =
      result.output?.filter((item) => item.type === "function_call") ?? [];
    if (!calls.length)
      return new Response(
        JSON.stringify({
          ...result,
          usage: knownUsage ? usage : undefined,
          management_actions: receipts,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    input.push(...result.output);
    for (const call of calls) {
      let output;
      const fingerprint = JSON.stringify([call.name, call.arguments]);
      if (seen.has(call.call_id)) {
        const previous = seen.get(call.call_id);
        if (previous.fingerprint !== fingerprint)
          throw Error("Identificador de herramienta inconsistente.");
        output = previous.output;
      } else {
        try {
          const args = JSON.parse(call.arguments);
          const hex = createHash("sha256")
            .update(`${requestId}:${call.call_id}`)
            .digest("hex")
            .slice(0, 32);
          const commandId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
          output = {
            ok: true,
            data: await execute(call.name, args, commandId),
          };
          if (call.name !== "study_work")
            receipts.push({ name: call.name, command_id: commandId });
        } catch (error) {
          output = { ok: false, error: error.code ?? error.message };
        }
        seen.set(call.call_id, { fingerprint, output });
      }
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(output),
      });
    }
    await reserve();
  }
}
