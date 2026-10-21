import { api, content } from "./api.js";
import { browserStore } from "./local-api.js";
import { extractDocument } from "./document-extraction.js";
import type { Document } from "../../../os-core/src/contracts.js";
import type { WorkspaceAttachment } from "../../../packages/workspace/src/tasks.js";
import type { JSONContent } from "@tiptap/core";
import { textDocument } from "../../../packages/workspace/src/model.js";
import { unzipSync } from "fflate";

/** Import into a separate working copy. Never modify the stored original. */
export async function importWorkspaceOriginal(
  base: string,
  document: Document,
) {
  const attachment = await readWorkspaceOriginal(base, document);
  const version = browserStore()
    .snapshot()
    .tables.documentVersions.find((v) => v.id === document.current_version_id)!;
  let rich = textDocument(attachment.text);
  const notices = [...attachment.warnings];
  if (/\.docx$/i.test(version.original_filename)) {
    const bytes = new Uint8Array(
      await (
        await content(
          `${base}/documents/${document.id}/versions/${version.id}/content`,
        )
      ).arrayBuffer(),
    );
    let expanded = 0;
    const parts = unzipSync(bytes, {
      filter: (entry) => {
        const selected =
          /^word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$/.test(
            entry.name,
          );
        if (selected && (expanded += entry.originalSize) > 32 * 1024 * 1024)
          throw Error("Documento Word demasiado grande para importar.");
        return selected;
      },
    });
    function parse(bytes: Uint8Array) {
      const xml = new TextDecoder().decode(bytes);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml))
        throw Error("Formato Word no admitido.");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (doc.querySelector("parsererror"))
        throw Error("No se pudo interpretar el Word.");
      return doc;
    }
    const child = (e: Element, name: string) =>
      Array.from(e.children).find((c) => c.localName === name);
    const val = (e?: Element) =>
      e?.getAttributeNS(
        "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "val",
      ) ?? e?.getAttribute("w:val");
    function paragraph(e: Element): JSONContent {
      const content: JSONContent[] = [];
      for (const node of Array.from(e.getElementsByTagNameNS("*", "r"))) {
        const props = child(node, "rPr");
        const marks: JSONContent["marks"] = [];
        for (const [tag, type] of [
          ["b", "bold"],
          ["i", "italic"],
          ["u", "underline"],
          ["strike", "strike"],
        ]) {
          const p = props && child(props, tag!);
          if (p && !["0", "false", "none"].includes(val(p) ?? "1"))
            marks.push({ type: type! });
        }
        for (const t of Array.from(node.children)) {
          const text =
            t.localName === "t"
              ? t.textContent
              : t.localName === "delText"
                ? `[ELIMINADO: ${t.textContent}]`
                : t.localName === "tab"
                  ? "\t"
                  : "";
          if (text)
            content.push({
              type: "text",
              text,
              ...(marks.length ? { marks } : {}),
            });
          if (["br", "cr"].includes(t.localName))
            content.push({ type: "hardBreak" });
        }
      }
      const props = child(e, "pPr"),
        style = props && val(child(props, "pStyle"));
      const heading = /^(?:Heading|T[ií]tulo)([1-6])$/i.exec(style ?? "");
      const align = props && val(child(props, "jc"));
      return {
        type: heading ? "heading" : "paragraph",
        attrs: {
          ...(heading ? { level: Number(heading[1]) } : {}),
          ...(align ? { textAlign: align === "both" ? "justify" : align } : {}),
        },
        content,
      };
    }
    function blocks(e: Element): JSONContent[] {
      return Array.from(e.children).flatMap((n) => {
        if (n.localName === "p") return [paragraph(n)];
        if (n.localName === "tbl")
          return [
            {
              type: "table",
              content: Array.from(n.children)
                .filter((r) => r.localName === "tr")
                .map((r) => ({
                  type: "tableRow",
                  content: Array.from(r.children)
                    .filter((c) => c.localName === "tc")
                    .map((c) => ({
                      type: "tableCell",
                      content: blocks(c).length
                        ? blocks(c)
                        : [{ type: "paragraph" }],
                    })),
                })),
            },
          ];
        return [];
      });
    }
    const doc = parse(parts["word/document.xml"]!);
    const body = doc.getElementsByTagNameNS("*", "body")[0];
    const importedContent = body ? blocks(body) : [];
    // Preserve notes and headers as visible supporting text rather than silently omitting them.
    for (const name of Object.keys(parts)
      .filter((n) => n !== "word/document.xml")
      .sort()) {
      const text = Array.from(
        parse(parts[name]!).getElementsByTagNameNS("*", "p"),
      ).map((p) => paragraph(p));
      importedContent.push(...text);
    }
    if (importedContent.length)
      rich = { type: "doc", content: importedContent };
    notices.push(
      "Copia editable de Word: se importan párrafos, estilos básicos y tablas. Revisá numeración, imágenes y diseño contra el original.",
    );
  } else if (/\.pdf$/i.test(version.original_filename)) {
    notices.push(
      "Copia editable del texto del PDF. Revisá la disposición y las tablas contra el original antes de aprobar.",
    );
  }
  return { rich, attachment, notices };
}
export async function readWorkspaceOriginal(
  base: string,
  document: Document,
): Promise<WorkspaceAttachment> {
  await api(base + "/documents");
  const stored = browserStore()
    .snapshot()
    .legal_team?.document_extractions.find(
      (e) =>
        e.document_id === document.id &&
        e.version_id === document.current_version_id,
    );
  const version = browserStore()
    .snapshot()
    .tables.documentVersions.find((v) => v.id === document.current_version_id);
  if (!version) throw Error("No se encontró la versión original.");
  const extraction =
    stored ??
    (await extractDocument(
      new Uint8Array(
        await (
          await content(
            `${base}/documents/${document.id}/versions/${version.id}/content`,
          )
        ).arrayBuffer(),
      ),
      version.original_filename,
    ));
  if (
    extraction.status === "UNREADABLE" ||
    !extraction.text.trim() ||
    extraction.units.some((u) => !u.readable)
  )
    throw Error(
      extraction.warnings.join(" ") ||
        "El original no tiene texto legible. Incorporá una versión con texto u OCR.",
    );
  return {
    document_id: document.id,
    version_id: version.id,
    title: document.title,
    text: extraction.text,
    text_sha256: extraction.text_sha256,
    original_sha256: version.sha256,
    warnings: extraction.warnings,
  };
}
