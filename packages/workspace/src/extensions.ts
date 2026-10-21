import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Typography, ParagraphLayout, PageBreak } from './word-extensions.js';
import { ReviewMarks } from './review-marks.js';

/** Shared schema for client, initial import and server validation. No commercial extensions. */
export function workspaceExtensions(localHistory = false) {
  return [
    StarterKit.configure({ undoRedo: localHistory ? {} : false, link: false }),
    TableKit.configure({ table: { resizable: false } }),
    Typography, ParagraphLayout, PageBreak, ReviewMarks,
  ];
}
