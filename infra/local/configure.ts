import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
mkdirSync(".local-dev", { recursive: true });
if (existsSync(".local-dev/app-config.json"))
  throw Error(
    "CONFIG_ALREADY_EXISTS: edit locally; secrets will not be overwritten",
  );
const passwords = JSON.parse(
  readFileSync(".local-dev/postgres-secrets.json", "utf8"),
);
const config = {
  database_url: `postgresql://os_app_login:${passwords.runtime}@127.0.0.1:55432/law_order_local`,
  auth_database_url: `postgresql://postgres:${passwords.admin}@127.0.0.1:55432/law_order_local`,
  supabase_url: "http://127.0.0.1:54321",
  supabase_key: "LOCAL_SUPABASE_SECRET_KEY_REQUIRED",
  session_key: randomBytes(32).toString("hex"),
  origin: "http://127.0.0.1:4310",
  port: 4310,
};
writeFileSync(".local-dev/app-config.json", JSON.stringify(config, null, 2), {
  flag: "wx",
  mode: 0o600,
});
console.log(
  "Configuración creada en .local-dev/app-config.json (ignorada por Git). Completar la clave de Supabase LOCAL; nunca utilizar una cuenta cloud.",
);
