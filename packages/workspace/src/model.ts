import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import * as Y from "yjs";
import {
  IdSchema,
  TimestampSchema,
  FirmRoleSchema,
  MatterPermissionSchema,
  MatterInputSchema,
  ClientInputSchema,
} from "../../../os-core/src/contracts.js";

export const WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_WORKSPACE_BYTES = 2 * 1024 * 1024;
export const LocalProfileSchema = z.union([
  z.enum(["local-administrator", "local-lawyer"]),
  z.uuid(),
]);
export type LocalProfile = z.infer<typeof LocalProfileSchema>;
export const localNames: Record<string, string> = {
  "local-administrator": "Administrador local",
  "local-lawyer": "Abogado local",
};
const scope = { law_firm_id: IdSchema, matter_id: IdSchema };
const created = { id: IdSchema, created_at: TimestampSchema };
export const WorkspaceSeedSchema = z
  .object({
    initial_rich: z.json().optional(),
    actor_id: LocalProfileSchema,
    synthetic_data: z.boolean(),
    firm: z.object({ ...created, name: z.string().min(1).max(240) }).strict(),
    client: z.discriminatedUnion("kind", [
      ClientInputSchema.options[0].extend({
        ...created,
        law_firm_id: IdSchema,
      }),
      ClientInputSchema.options[1].extend({
        ...created,
        law_firm_id: IdSchema,
      }),
    ]),
    matter: MatterInputSchema.extend({
      ...created,
      law_firm_id: IdSchema,
      status: z.enum(["OPEN", "CLOSED"]),
    }).strict(),
    memberships: z
      .array(
        z
          .object({
            ...created,
            law_firm_id: IdSchema,
            identity_id: LocalProfileSchema,
            role: FirmRoleSchema,
            active: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    participants: z
      .array(
        z
          .object({
            ...created,
            ...scope,
            identity_id: LocalProfileSchema,
            permissions: z.array(MatterPermissionSchema).min(1).max(6),
            active: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    document: z
      .object({
        ...created,
        ...scope,
        title: z.string().min(1).max(240),
        purpose: z.literal("DRAFT"),
        current_version_id: IdSchema,
      })
      .strict(),
    draft: z
      .object({
        ...created,
        ...scope,
        document_id: IdSchema,
        document_version_id: IdSchema,
        author_identity_id: LocalProfileSchema,
        coauthor_identity_ids: z.array(LocalProfileSchema).max(64).optional(),
        status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "CHANGES_REQUESTED"]),
      })
      .strict(),
    version: z
      .object({
        id: IdSchema,
        ...scope,
        document_id: IdSchema,
        original_base64: z.string().max(1_400_000),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        mime_type: z.string().max(100),
        original_filename: z.string().max(240),
        incorporated_by: LocalProfileSchema,
        incorporated_at: TimestampSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const firm = s.firm.id,
      matter = s.matter.id;
    if (
      s.client.law_firm_id !== firm ||
      s.matter.law_firm_id !== firm ||
      s.matter.client_id !== s.client.id ||
      [
        ...s.memberships,
        ...s.participants,
        s.document,
        s.draft,
        s.version,
      ].some((r) => r.law_firm_id !== firm) ||
      [...s.participants, s.document, s.draft, s.version].some(
        (r) => r.matter_id !== matter,
      ) ||
      s.draft.document_id !== s.document.id ||
      s.version.document_id !== s.document.id ||
      s.draft.document_version_id !== s.version.id ||
      s.document.current_version_id !== s.version.id
    )
      ctx.addIssue({ code: "custom", message: "WORKSPACE_SCOPE_MISMATCH" });
  });
export type WorkspaceSeed = z.infer<typeof WorkspaceSeedSchema>;

export interface WorkspaceRoom {
  id: string;
  law_firm_id: string;
  matter_id: string;
  document_id: string;
  draft_id: string;
  title: string;
  matter_title: string;
  client_name: string;
  revision: number;
  checkpoint_version_id: string;
  source_version_id: string;
  updated_at: string;
}
export interface WorkspaceAccess {
  room: WorkspaceRoom;
  token: string;
  actor_id: LocalProfile;
  display_name: string;
  read_only: boolean;
  source_changed?: boolean;
  browser_version_id?: string;
  can_manage?: boolean;
}
export interface DurableReceipt {
  kind: "durable";
  room_id: string;
  revision: number;
  vector: string;
  state_hash: string;
  saved_at: string;
  deletions: Array<[number, Array<[number, number]>]>;
}
export function deletionRanges(
  update: Uint8Array,
): DurableReceipt["deletions"] {
  return [...Y.decodeUpdate(update).ds.clients].map(([client, ranges]) => [
    client,
    ranges.map((r) => [r.clock, r.len]),
  ]);
}
/** State vectors alone do not acknowledge deletions: their clocks can remain unchanged. */
export function receiptCovers(receipt: DurableReceipt, doc: Y.Doc): boolean {
  if (!vectorCovers(fromBase64(receipt.vector), Y.encodeStateVector(doc)))
    return false;
  const committed = new Map(receipt.deletions);
  return deletionRanges(Y.encodeStateAsUpdate(doc)).every(([client, ranges]) =>
    ranges.every(([clock, len]) =>
      (committed.get(client) ?? []).some(
        ([start, length]) => start <= clock && start + length >= clock + len,
      ),
    ),
  );
}
export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}
export function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
/** A Yjs sync acknowledgment is not a durable write. Compare the committed vector explicitly. */
export function vectorCovers(
  committed: Uint8Array,
  local: Uint8Array,
): boolean {
  const a = Y.decodeStateVector(committed),
    b = Y.decodeStateVector(local);
  return [...b].every(([client, clock]) => (a.get(client) ?? 0) >= clock);
}
export function textDocument(text: string): JSONContent {
  return {
    type: "doc",
    content: text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => ({
        type: "paragraph",
        ...(line ? { content: [{ type: "text", text: line }] } : {}),
      })),
  };
}
export function documentText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const values = (node.content ?? []).map(documentText);
  return values.join(
    [
      "doc",
      "bulletList",
      "orderedList",
      "table",
      "tableRow",
      "listItem",
      "blockquote",
    ].includes(node.type ?? "")
      ? "\n"
      : "",
  );
}
