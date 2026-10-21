import { it, expect } from "vitest";
// @ts-expect-error Native host, provider transport replaced with a synthetic model.
import { managementConversation } from "../../scripts/gabriel-management.mjs";
// @ts-expect-error Native realtime host.
import { voiceSession } from "../../scripts/gabriel-realtime.mjs";
import { managementTools } from "../../packages/workspace/src/management-tools.js";

const schema = {
  type: "object",
  properties: { reply: { type: "string" } },
  required: ["reply"],
  additionalProperties: false,
};
it("lets the model read, choose and execute management tools, preserving tool receipts and usage", async () => {
  const sent: any[] = [],
    executed: any[] = [],
    reservations: any[] = [];
  const tools = [
    { name: "study_work", args: { team: true, matter_id: null } },
    {
      name: "assign_task",
      args: {
        mode: "CREATE",
        matter_id: "case",
        task_id: null,
        title: "Revisar anexos",
        responsible_identity_id: "lawyer",
        due_at: null,
        expected_revision: null,
      },
    },
  ];
  const response = await managementConversation({
    request: {
      history: [{ role: "user", content: "Seguimos el trabajo de ayer" }],
      message: "Que Ana revise los anexos",
      view: "agenda",
      context: {},
      firm_id: "firm",
    },
    policy: "No crees, elimines ni ejecutes nada.",
    schema,
    model: "gpt-6-luna",
    requestId: "turn-1",
    options: { signal: new AbortController().signal, headers: {} },
    transport: async (_url: string, options: any) => {
      const body = JSON.parse(options.body);
      sent.push(body);
      const index = sent.length - 1,
        tool = tools[index];
      return new Response(
        JSON.stringify({
          model: "gpt-6-luna",
          status: "completed",
          service_tier: "default",
          usage: { input_tokens: 100, output_tokens: 30 },
          output: tool
            ? [
                {
                  type: "function_call",
                  call_id: `call-${index}`,
                  name: tool.name,
                  arguments: JSON.stringify(tool.args),
                },
              ]
            : [
                {
                  type: "message",
                  role: "assistant",
                  content: [
                    {
                      type: "output_text",
                      text: '{"reply":"Tarea asignada y registrada"}',
                    },
                  ],
                },
              ],
        }),
      );
    },
    execute: async (name: string, args: any, id: string) => {
      executed.push({ name, args, id });
      return name === "study_work"
        ? {
            role: "ADMINISTRATOR",
            people: [{ identity_id: "lawyer", display_name: "Ana" }],
          }
        : { id: "persisted-task", assigned_by: "session-director" };
    },
    reserve: async () => reservations.push(1),
  });
  const result = await response.json();
  expect(sent).toHaveLength(3);
  expect(executed.map((c) => c.name)).toEqual(["study_work", "assign_task"]);
  expect(executed[1].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(
    sent[1].input.find((i: any) => i.type === "function_call_output").output,
  ).toContain('"ADMINISTRATOR"');
  expect(
    sent[2].input.find(
      (i: any) => i.call_id === "call-1" && i.type === "function_call_output",
    ).output,
  ).toContain("persisted-task");
  expect(result.management_actions).toHaveLength(1);
  expect(result.usage).toEqual({ input_tokens: 300, output_tokens: 90 });
  expect(reservations).toHaveLength(2);
  expect(sent[0].instructions).toContain("sesión actual");
  expect(sent[0].instructions).not.toContain(
    "No crees, elimines ni ejecutes nada.",
  );
});
it("returns server denial to the model instead of announcing an assignment", async () => {
  const inputs: any[] = [];
  let count = 0;
  const response = await managementConversation({
    request: {
      history: [],
      message: "Asignale esto a otro abogado",
      view: "agenda",
      context: {},
    },
    policy: "",
    schema,
    model: "gpt-6-luna",
    requestId: "turn-denied",
    options: { signal: new AbortController().signal, headers: {} },
    transport: async (_url: string, o: any) => {
      inputs.push(JSON.parse(o.body));
      return new Response(
        JSON.stringify({
          model: "gpt-6-luna",
          status: "completed",
          output:
            count++ === 0
              ? [
                  {
                    type: "function_call",
                    call_id: "denied",
                    name: "assign_task",
                    arguments: "{}",
                  },
                ]
              : [
                  {
                    type: "message",
                    content: [
                      {
                        type: "output_text",
                        text: '{"reply":"Tu rol requiere solicitar la intervención a Dirección"}',
                      },
                    ],
                  },
                ],
        }),
      );
    },
    execute: async () => {
      throw Error("DIRECTOR_REQUIRED");
    },
    reserve: async () => {},
  });
  expect(
    inputs[1].input.find((i: any) => i.type === "function_call_output").output,
  ).toContain('"ok":false');
  expect((await response.json()).management_actions).toEqual([]);
});
it("exposes identical management capabilities in native voice with no selectable actor", () => {
  const session = voiceSession({ view: "agenda" });
  for (const tool of managementTools) {
    const actual = session.tools.find((t: any) => t.name === tool.name);
    expect(actual).toEqual(tool);
    expect(JSON.stringify(actual.parameters)).not.toContain("actor_id");
  }
  expect(session.instructions).toContain("ni adquirís permisos");
});
