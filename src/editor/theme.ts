import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/**
 * The editor theme reads the app's CSS custom properties, so switching the app
 * theme restyles the editor with no reconfiguration.
 */
export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--code-bg)",
    color: "var(--text)",
    fontSize: "var(--editor-font-size, 14px)",
  },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--accent)", padding: "8px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-gutters": {
    backgroundColor: "var(--code-bg)",
    color: "var(--text-subtle)",
    border: "none",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLineGutter": { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--surface-3) 45%, transparent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent) !important",
  },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
    outline: "none",
  },
  ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--warning) 30%, transparent)" },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in srgb, var(--warning) 55%, transparent)",
  },
  ".cm-panels": {
    backgroundColor: "var(--surface-2)",
    color: "var(--text)",
    borderTop: "1px solid var(--border)",
  },
  ".cm-panels input, .cm-panels button": { fontSize: "var(--text-sm)" },
  ".cm-tooltip": {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--danger)",
  },
  "&.cm-focused": { outline: "none" },
});

export const highlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.modifier],
      color: "var(--syntax-keyword)",
    },
    { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "var(--syntax-string)" },
    { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syntax-number)" },
    {
      tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
      color: "var(--syntax-comment)",
      fontStyle: "italic",
    },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName],
      color: "var(--syntax-function)",
    },
    { tag: [t.typeName, t.className, t.namespace, t.tagName], color: "var(--syntax-type)" },
    { tag: [t.variableName, t.propertyName, t.attributeName], color: "var(--syntax-variable)" },
    { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: "var(--syntax-operator)" },
    { tag: [t.meta, t.processingInstruction], color: "var(--syntax-keyword)" },
    { tag: t.invalid, color: "var(--danger)" },
  ]),
);
