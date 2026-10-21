import { it, expect } from "vitest";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";

const clientBin = resolve(".local-dev/postgres-client/pgsql/bin");
it.skipIf(!existsSync(resolve(clientBin, "pg_dump.exe")))(
  "copies WIN1252 losslessly to UTF8, retains the original and refuses active clients",
  async () => {
    const secrets = JSON.parse(
      await readFile(".local-dev/postgres-secrets.json", "utf8"),
    );
    const suffix = randomUUID().replaceAll("-", "");
    const sourceName = "law_order_test_" + suffix;
    const temporary = resolve(".local-dev", "utf8-migration-test-" + suffix);
    const maintenance = new Pool({
      host: "127.0.0.1",
      port: 55432,
      user: "postgres",
      password: secrets.admin,
      database: "postgres",
    });
    let sourceDb: Pool | undefined,
      targetDb: Pool | undefined,
      targetName: string | undefined;
    const script = resolve("scripts/local-database-utf8.mjs");
    const configFile = resolve(temporary, ".local-dev/app-config.json");
    const call = () =>
      promisify(execFile)(process.execPath, [script, clientBin], {
        cwd: temporary,
        windowsHide: true,
      });
    try {
      await maintenance.query(
        `CREATE DATABASE "${sourceName}" WITH TEMPLATE template0 ENCODING 'WIN1252' LC_COLLATE 'C' LC_CTYPE 'C'`,
      );
      sourceDb = new Pool({
        host: "127.0.0.1",
        port: 55432,
        user: "postgres",
        password: secrets.admin,
        database: sourceName,
      });
      await sourceDb.query(
        'CREATE SCHEMA os_private; CREATE TABLE os_private.workspace_jobs (id serial PRIMARY KEY,status text); CREATE TABLE os_private.records (id serial PRIMARY KEY, body jsonb); INSERT INTO os_private.records(body) VALUES (\'{"text":"Niño, obligación y €"}\')',
      );
      await mkdir(resolve(temporary, ".local-dev"), { recursive: true });
      const connection = new URL(
        "postgresql://postgres@127.0.0.1:55432/" + sourceName,
      );
      connection.password = secrets.admin;
      const original = JSON.stringify({
        database_url: connection.href,
        auth_database_url: connection.href,
      });
      await writeFile(configFile, original);
      // The still-open source pool represents an active app; configuration stays intact.
      await expect(call()).rejects.toMatchObject({
        stderr: expect.stringContaining(
          "STOP_LOCAL_APPLICATION_BEFORE_MIGRATION",
        ),
      });
      expect(await readFile(configFile, "utf8")).toBe(original);
      await sourceDb.end();
      sourceDb = undefined;
      const migrated = await call();
      expect(JSON.parse(migrated.stdout)).toMatchObject({
        status: "MIGRATED",
        source_encoding: "WIN1252",
        target_encoding: "UTF8",
        original_database_retained: true,
        tables_verified: 2,
        rows_verified: 1,
      });
      const config = JSON.parse(await readFile(configFile, "utf8"));
      targetName = new URL(config.auth_database_url).pathname.slice(1);
      expect(targetName).not.toBe(sourceName);
      targetDb = new Pool({ connectionString: config.auth_database_url });
      expect(
        (await targetDb.query("SHOW server_encoding")).rows[0].server_encoding,
      ).toBe("UTF8");
      expect(
        (await targetDb.query("SELECT body FROM os_private.records")).rows[0]
          .body.text,
      ).toBe("Niño, obligación y €");
      const value = "Contrato 😀 中文 \uFFFD";
      await targetDb.query("INSERT INTO os_private.records(body) VALUES ($1)", [
        { text: value },
      ]);
      expect(
        (await targetDb.query("SELECT body FROM os_private.records WHERE id=2"))
          .rows[0].body.text,
      ).toBe(value);
      sourceDb = new Pool({ connectionString: connection.href });
      expect(
        (await sourceDb.query("SHOW server_encoding")).rows[0].server_encoding,
      ).toBe("WIN1252");
      expect(
        (await sourceDb.query("SELECT count(*)::int n FROM os_private.records"))
          .rows[0].n,
      ).toBe(1);
      expect(JSON.parse((await call()).stdout)).toEqual({
        status: "ALREADY_UTF8",
      });
    } finally {
      await Promise.allSettled([sourceDb?.end(), targetDb?.end()]);
      if (!/^law_order_test_[a-f0-9]{32}$/.test(sourceName))
        throw Error("INVALID_TEST_DATABASE");
      await maintenance.query(`DROP DATABASE "${sourceName}"`);
      if (targetName) {
        if (!/^law_order_utf8_[0-9]+_[a-f0-9]{6}$/.test(targetName))
          throw Error("INVALID_TEST_DATABASE_COPY");
        await maintenance.query(`DROP DATABASE "${targetName}"`);
      }
      await maintenance.end();
      if (temporary !== resolve(".local-dev", "utf8-migration-test-" + suffix))
        throw Error("INVALID_TEST_DIRECTORY");
      await rm(temporary, { recursive: true, force: true });
    }
  },
  60000,
);
