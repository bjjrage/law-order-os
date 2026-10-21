import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
const fonts = ["Calibri", "Arial", "Times New Roman", "Georgia", "Courier New"];
const color = (value: unknown) =>
  typeof value === "string" && /^#[a-f0-9]{6}$/i.test(value) ? value : null;
export const Typography = Mark.create({
  name: "typography",
  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (el) =>
          fonts.includes(el.style.fontFamily.replace(/["']/g, ""))
            ? el.style.fontFamily.replace(/["']/g, "")
            : null,
      },
      fontSize: {
        default: null,
        parseHTML: (el) =>
          /^([9]|[1-3][0-9]|4[0-8])pt$/.test(el.style.fontSize)
            ? el.style.fontSize
            : null,
      },
      color: { default: null, parseHTML: (el) => color(el.style.color) },
      highlight: {
        default: null,
        parseHTML: (el) => color(el.style.backgroundColor),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[style]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes;
    const styles = [
      fonts.includes(a.fontFamily) ? `font-family:${a.fontFamily}` : "",
      /^([9]|[1-3][0-9]|4[0-8])pt$/.test(a.fontSize ?? "")
        ? `font-size:${a.fontSize}`
        : "",
      color(a.color) ? `color:${a.color}` : "",
      color(a.highlight) ? `background-color:${a.highlight}` : "",
    ]
      .filter(Boolean)
      .join(";");
    return ["span", { style: styles }, 0];
  },
});
export const ParagraphLayout = Extension.create({
  name: "paragraphLayout",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: "left",
            parseHTML: (el) =>
              ["left", "center", "right", "justify"].includes(
                el.style.textAlign,
              )
                ? el.style.textAlign
                : "left",
            renderHTML: (a) => ({
              style: `text-align:${["left", "center", "right", "justify"].includes(a.textAlign) ? a.textAlign : "left"}`,
            }),
          },
          lineHeight: {
            default: "1.5",
            parseHTML: (el) =>
              ["1", "1.15", "1.5", "2"].includes(el.style.lineHeight)
                ? el.style.lineHeight
                : "1.5",
            renderHTML: (a) => ({
              style: `line-height:${["1", "1.15", "1.5", "2"].includes(a.lineHeight) ? a.lineHeight : "1.5"}`,
            }),
          },
          indent: {
            default: 0,
            parseHTML: (el) =>
              Math.min(
                8,
                Math.max(
                  0,
                  Math.round(parseFloat(el.style.marginLeft || "0") / 24),
                ),
              ),
            renderHTML: (a) => ({
              style: `margin-left:${Math.min(8, Math.max(0, Number(a.indent) || 0)) * 24}px`,
            }),
          },
        },
      },
    ];
  },
});
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "true",
        class: "word-page-break",
      }),
      "Salto de página",
    ];
  },
});
