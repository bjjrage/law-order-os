import { zipSync, strToU8 } from "fflate";
import type { JSONContent } from "@tiptap/core";
const xml = (value: unknown) =>
  String(value ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
function run(node: JSONContent): string {
  if (node.type === "hardBreak") return "<w:r><w:br/></w:r>";
  const marks = node.marks ?? [],
    type = marks.find((m) => m.type === "typography")?.attrs ?? {};
  const properties = [
    marks.some((m) => m.type === "bold") ? "<w:b/>" : "",
    marks.some((m) => m.type === "italic") ? "<w:i/>" : "",
    marks.some((m) => m.type === "underline") ? '<w:u w:val="single"/>' : "",
    marks.some((m) => m.type === "strike") ? "<w:strike/>" : "",
    type.fontFamily
      ? `<w:rFonts w:ascii="${xml(type.fontFamily)}" w:hAnsi="${xml(type.fontFamily)}"/>`
      : "",
    type.fontSize
      ? `<w:sz w:val="${Math.round(parseFloat(type.fontSize) * 2)}"/>`
      : "",
    /^#[a-f0-9]{6}$/i.test(type.color ?? "")
      ? `<w:color w:val="${type.color.slice(1)}"/>`
      : "",
    /^#[a-f0-9]{6}$/i.test(type.highlight ?? "")
      ? `<w:shd w:fill="${type.highlight.slice(1)}"/>`
      : "",
  ].join("");
  return `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${xml(node.text)}</w:t></w:r>`;
}
function block(
  node: JSONContent,
  list?: { id: number; level: number },
): string {
  if (node.type === "text" || node.type === "hardBreak") return run(node);
  if (node.type === "pageBreak")
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  if (node.type === "bulletList" || node.type === "orderedList")
    return (node.content ?? [])
      .map((n) =>
        block(n, {
          id: node.type === "orderedList" ? 1 : 2,
          level: list ? Math.min(8, list.level + 1) : 0,
        }),
      )
      .join("");
  if (node.type === "listItem")
    return (node.content ?? [])
      .map((n, i) => block(n, i === 0 ? list : undefined))
      .join("");
  if (node.type === "table")
    return (
      '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' +
      ["top", "left", "bottom", "right", "insideH", "insideV"]
        .map((n) => `<w:${n} w:val="single" w:sz="4" w:color="AAB8B3"/>`)
        .join("") +
      "</w:tblBorders></w:tblPr>" +
      (node.content ?? []).map((n) => block(n)).join("") +
      "</w:tbl>"
    );
  if (node.type === "tableRow")
    return (
      "<w:tr>" + (node.content ?? []).map((n) => block(n)).join("") + "</w:tr>"
    );
  if (node.type === "tableCell" || node.type === "tableHeader")
    return (
      "<w:tc><w:tcPr>" +
      (Number(node.attrs?.colspan) > 1
        ? `<w:gridSpan w:val="${Number(node.attrs?.colspan)}"/>`
        : "") +
      (node.type === "tableHeader" ? '<w:shd w:fill="EDF2EC"/>' : "") +
      "</w:tcPr>" +
      (node.content?.length
        ? node.content.map((n) => block(n)).join("")
        : "<w:p/>") +
      "</w:tc>"
    );
  if (node.type === "paragraph" || node.type === "heading") {
    const a = node.attrs ?? {};
    return (
      "<w:p><w:pPr>" +
      (node.type === "heading"
        ? `<w:pStyle w:val="Heading${Math.min(3, Number(a.level) || 1)}"/>`
        : "") +
      (list
        ? `<w:numPr><w:ilvl w:val="${list.level}"/><w:numId w:val="${list.id}"/></w:numPr>`
        : "") +
      `<w:jc w:val="${a.textAlign === "justify" ? "both" : xml(a.textAlign || "left")}"/><w:spacing w:after="120" w:line="${Math.round((Number(a.lineHeight) || 1.5) * 240)}" w:lineRule="auto"/><w:ind w:left="${Math.min(8, Number(a.indent) || 0) * 360}"/></w:pPr>` +
      (node.content ?? []).map(run).join("") +
      "</w:p>"
    );
  }
  return (node.content ?? []).map((n) => block(n, list)).join("");
}
export function exportWord(content: JSONContent) {
  const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const document =
    header +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    block(content) +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>';
  const numbering =
    header +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    [1, 2]
      .map(
        (id) =>
          `<w:abstractNum w:abstractNumId="${id}">` +
          Array.from(
            { length: 9 },
            (_, level) =>
              `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${id === 1 ? "decimal" : "bullet"}"/><w:lvlText w:val="${id === 1 ? "%" + (level + 1) + "." : "•"}"/><w:pPr><w:ind w:left="${720 + level * 360}" w:hanging="360"/></w:pPr></w:lvl>`,
          ).join("") +
          `</w:abstractNum><w:num w:numId="${id}"><w:abstractNumId w:val="${id}"/></w:num>`,
      )
      .join("") +
    "</w:numbering>";
  const styles =
    header +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    [1, 2, 3]
      .map(
        (level) =>
          `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:pPr><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${[36, 30, 26][level - 1]}"/></w:rPr></w:style>`,
      )
      .join("") +
    "</w:styles>";
  return zipSync({
    "[Content_Types].xml": strToU8(
      header +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      header +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/document.xml": strToU8(document),
    "word/styles.xml": strToU8(styles),
    "word/numbering.xml": strToU8(numbering),
    "word/_rels/document.xml.rels": strToU8(
      header +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="numbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>',
    ),
  });
}
