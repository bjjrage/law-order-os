// Local outbox consumer. It records processing only; no mail, LLM or external effect.
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { ConfigSchema } from "./config.js";
const config = ConfigSchema.parse(
  JSON.parse(readFileSync(".local-dev/app-config.json", "utf8")),
);
const pool = new Pool({ connectionString: config.auth_database_url });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const events = await client.query(
      "SELECT id FROM os_private.outbox WHERE done_at IS NULL ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 100",
    );
    for (const event of events.rows)
      await client.query(
        "UPDATE os_private.outbox SET done_at=now() WHERE id=$1 AND done_at IS NULL",
        [event.id],
      );
    await client.query("COMMIT");
    console.log(
      JSON.stringify({
        processed: events.rowCount,
        external_effects: 0,
        paid_calls: 0,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
