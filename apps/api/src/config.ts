import { z } from "zod";
export function localUrl(value: string) {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw Error("LOCAL_DEVELOPMENT_ONLY");
  return value;
}
export const ConfigSchema = z
  .object({
    database_url: z.string().transform(localUrl),
    auth_database_url: z.string().transform(localUrl),
    supabase_url: z.string().transform(localUrl),
    supabase_key: z.string().min(1),
    session_key: z.string().regex(/^[a-f0-9]{64}$/),
    origin: z.string().transform(localUrl),
    port: z.number().int().min(1024).max(65535).default(4310),
  })
  .strict();
export type Config = z.infer<typeof ConfigSchema>;
export function localFetch(origin: string, timeout: number): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (new URL(url).origin !== new URL(origin).origin)
      throw Error("LOCAL_REQUEST_ONLY");
    return fetch(input, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    });
  };
}
