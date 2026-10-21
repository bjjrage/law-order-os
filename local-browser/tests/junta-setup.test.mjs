import { expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { prepare, inspect } from "../../scripts/junta-setup.mjs";
it("prepares empty credentials without overwriting existing secrets and never returns values", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "law-order-junta-setup-"));
  try {
    await mkdir(resolve(root, "junta-local"));
    await writeFile(
      resolve(root, "junta-local/config.env.example"),
      await readFile("junta-local/config.env.example"),
    );
    expect((await prepare(root)).env_file).toBe("CREATED_EMPTY");
    const before = await readFile(resolve(root, ".env"), "utf8");
    expect((await inspect(root, {})).missing_keys).toEqual([
      "JEV_API_KEY",
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
    ]);
    await writeFile(
      resolve(root, ".env"),
      before.replace(
        "OPENAI_API_KEY=",
        "OPENAI_API_KEY=synthetic-secret-never-output",
      ),
    );
    expect((await prepare(root)).env_file).toBe("PRESERVED");
    const status = await inspect(root, {
      GEMINI_API_KEY: "synthetic-inherited-secret",
    });
    expect(status.missing_keys).toEqual(["JEV_API_KEY"]);
    expect(status.model_configuration_ready).toBe(true);
    expect(status.execution_authorized).toBe(false);
    expect(JSON.stringify(status)).not.toMatch(
      /synthetic-secret|synthetic-inherited-secret/,
    );
    expect(
      status.providers.filter((p) => p.key_variable === "OPENAI_API_KEY"),
    ).toHaveLength(2);
  } finally {
    const target = resolve(root),
      allowed = resolve(tmpdir()) + sep;
    if (
      !target.startsWith(allowed) ||
      !target.slice(allowed.length).startsWith("law-order-junta-setup-")
    )
      throw Error("Unexpected cleanup target");
    await rm(target, { recursive: true, force: true });
  }
});
