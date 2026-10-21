import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { Pool } from "pg";
import {
  CoreError,
  type Authenticator,
  type AuthenticatedPrincipal,
  type Identity,
} from "../../../os-core/src/contracts.js";
import type { Config } from "./config.js";
import { localFetch } from "./config.js";
export interface SessionIdentity extends Authenticator {
  login(
    email: string,
    password: string,
  ): Promise<{ token: string; csrf: string }>;
  logout(token: string): Promise<void>;
  csrf(token: string): Promise<string | null>;
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class SupabaseSessions implements SessionIdentity {
  private readonly supabase: SupabaseClient;
  private readonly key: Buffer;
  constructor(
    private readonly pool: Pool,
    config: Config,
  ) {
    this.key = Buffer.from(config.session_key, "hex");
    this.supabase = createClient(config.supabase_url, config.supabase_key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: localFetch(config.supabase_url, 5000),
      },
    });
  }
  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
  }
  private decrypt(value: string) {
    const bytes = Buffer.from(value, "base64");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      bytes.subarray(0, 12),
    );
    cipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([
      cipher.update(bytes.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  }
  async login(email: string, password: string) {
    const client = this.supabase;
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error || !result.data.session || !result.data.user)
      throw new CoreError(
        result.error?.status === 400
          ? "UNAUTHENTICATED"
          : "IDENTITY_PROVIDER_UNAVAILABLE",
      );
    const { user, session } = result.data;
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    await this.pool.query(
      "INSERT INTO os_private.identities(id,subject,display_name,active) VALUES($1,$1,$2,true) ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name",
      [user.id, user.email ?? "Usuario de desarrollo"],
    );
    await this.pool.query(
      "INSERT INTO os_private.sessions(token_hash,identity_id,encrypted_tokens,csrf,expires_at) VALUES($1,$2,$3,$4,$5)",
      [
        hash(token),
        user.id,
        this.encrypt(
          JSON.stringify({
            access: session.access_token,
            refresh: session.refresh_token,
          }),
        ),
        csrf,
        new Date((session.expires_at ?? 0) * 1000),
      ],
    );
    return { token, csrf };
  }
  async authenticate(token: string): Promise<AuthenticatedPrincipal | null> {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const r = await this.pool.query(
      "SELECT s.identity_id,s.encrypted_tokens,s.expires_at FROM os_private.sessions s JOIN os_private.identities i ON i.id=s.identity_id WHERE s.token_hash=$1 AND NOT s.revoked AND s.expires_at>now() AND i.active",
      [hash(token)],
    );
    const row = r.rows[0];
    if (!row) return null;
    const tokens = JSON.parse(this.decrypt(row.encrypted_tokens));
    const result = await this.supabase.auth.getUser(tokens.access);
    if (result.error || result.data.user?.id !== row.identity_id) return null;
    return {
      identity_id: row.identity_id,
      subject: row.identity_id,
      session_id: hash(token),
      expires_at: new Date(row.expires_at).toISOString(),
    };
  }
  async identity(id: string): Promise<Identity | null> {
    const r = await this.pool.query(
      "SELECT id,subject,display_name,active FROM os_private.identities WHERE id=$1",
      [id],
    );
    return r.rows[0] ?? null;
  }
  async csrf(token: string) {
    const r = await this.pool.query(
      "SELECT csrf FROM os_private.sessions WHERE token_hash=$1 AND NOT revoked AND expires_at>now()",
      [hash(token)],
    );
    return r.rows[0]?.csrf ?? null;
  }
  async logout(token: string) {
    await this.pool.query(
      "UPDATE os_private.sessions SET revoked=true WHERE token_hash=$1",
      [hash(token)],
    );
  }
}
