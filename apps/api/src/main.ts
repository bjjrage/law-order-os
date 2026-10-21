import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { ConfigSchema } from "./config.js";
import { SupabaseSessions } from "./auth.js";
import { SupabasePrivateStorage } from "./storage.js";
import { PostgresPersistence } from "../../../packages/persistence-postgres/src/index.js";
import { buildServer } from "./server.js";
const config = ConfigSchema.parse(
  JSON.parse(readFileSync(".local-dev/app-config.json", "utf8")),
);
const pool = new Pool({ connectionString: config.database_url, max: 5 }),
  sessionPool = new Pool({
    connectionString: config.auth_database_url,
    max: 3,
  });
const persistence = new PostgresPersistence(
  pool,
  new SupabasePrivateStorage(config),
);
const app = buildServer({
  persistence,
  auth: new SupabaseSessions(sessionPool, config),
  sessionPool,
  origin: config.origin,
});
await app.listen({ host: "127.0.0.1", port: config.port });
console.log(
  `LAW & ORDER OS local: ${config.origin} — IA deshabilitada, solo datos sintéticos`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app
      .close()
      .then(() => Promise.all([pool.end(), sessionPool.end()]))
      .then(() => process.exit(0));
  });
