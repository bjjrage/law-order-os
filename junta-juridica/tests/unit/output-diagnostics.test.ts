import { expect, it, vi } from "vitest";
import { z } from "zod";
import { OpenAIProvider } from "../../src/providers/live.js";
import { EXPECTED_MODELS } from "../../src/providers/config.js";
it("retains the reason and reasoning-token count when Responses exhausts output, without returning partial output", async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: EXPECTED_MODELS.luna })),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: EXPECTED_MODELS.luna,
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output: [{ content: [{ type: "output_text", text: '{"ok":' }] }],
          usage: {
            input_tokens: 8000,
            output_tokens: 12000,
            output_tokens_details: { reasoning_tokens: 9000 },
          },
        }),
      ),
    );
  const provider = new OpenAIProvider(
    EXPECTED_MODELS.luna,
    "synthetic-key",
    z.object({ ok: z.boolean() }),
    "Technical test",
    "low",
    60000,
    12000,
    transport,
  );
  await provider.verifyAvailability(AbortSignal.timeout(1000));
  await expect(
    provider.invoke(
      provider.prepare({ fictional: true }),
      AbortSignal.timeout(1000),
    ),
  ).rejects.toMatchObject({
    code: "INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS",
    diagnostics: {
      response_status: "incomplete",
      incomplete_reason: "max_output_tokens",
      max_output_tokens: 12000,
      output_tokens: 12000,
      reasoning_tokens: 9000,
    },
  });
  expect(transport).toHaveBeenCalledTimes(2);
});
