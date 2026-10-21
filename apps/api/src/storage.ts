import { createClient } from "@supabase/supabase-js";
import type { BlobStore } from "../../../packages/persistence-postgres/src/index.js";
import type { Config } from "./config.js";
import { localFetch } from "./config.js";
export class SupabasePrivateStorage implements BlobStore {
  private readonly client;
  constructor(config: Config) {
    this.client = createClient(config.supabase_url, config.supabase_key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: localFetch(config.supabase_url, 10000),
      },
    });
  }
  async writeOnce(key: string, bytes: Uint8Array, mime: string) {
    const result = await this.client.storage
      .from("law-order-private")
      .upload(key, bytes, { contentType: mime, upsert: false });
    if (result.error) throw Error("PRIVATE_STORAGE_UNAVAILABLE");
  }
  async read(key: string) {
    const result = await this.client.storage
      .from("law-order-private")
      .download(key);
    if (result.error || !result.data)
      throw Error("PRIVATE_STORAGE_UNAVAILABLE");
    return new Uint8Array(await result.data.arrayBuffer());
  }
}
