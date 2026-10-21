import { expect, it } from "vitest";
import { handleJunta } from "../../scripts/junta-bridge.mjs";

it.each(["prepare", "consult", "run"])(
  "retires legacy %s execution without touching saved reports or calling a provider",
  async (action) => {
    let status, output;
    const origin = "http://127.0.0.1:4313";
    const req = {
      url: `/local/junta/case/${action}`,
      method: "POST",
      headers: { host: "127.0.0.1:4313", origin },
    };
    const res = {
      writeHead: (value) => {
        status = value;
      },
      end: (value) => {
        output = JSON.parse(value);
      },
    };
    expect(await handleJunta(req, res, origin)).toBe(true);
    expect(status).toBe(410);
    expect(output).toMatchObject({
      code: "LEGAL_WORKFLOW_UNIFIED",
      workflow: "legal-unified-v1",
    });
  },
);
