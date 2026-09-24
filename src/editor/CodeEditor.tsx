import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, indentUnit } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Diagnostic } from "@/domain/execution";
import type { LanguageId } from "@/domain/languages";
import styles from "./CodeEditor.module.css";
import { EDITOR_MODES } from "./modes";
import { editorTheme, highlightStyle } from "./theme";

export interface EditorShortcuts {
  onRun?: () => void;
  onTest?: () => void;
  onSave?: () => void;
}

export interface CodeEditorProps extends EditorShortcuts {
  value: string;
  language: LanguageId;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  tabSize?: number;
  fontSize?: number;
  diagnostics?: readonly Diagnostic[];
  /** Accessible name for the editor's textbox. */
  label: string;
  minHeight?: string;
}

/**
 * Thin React wrapper over CodeMirror 6. CodeMirror owns the document; React
 * pushes external changes in (value, language, options) through compartments
 * instead of recreating the view.
 */
export function CodeEditor({
  value,
  language,
  onChange,
  readOnly = false,
  tabSize = 2,
  fontSize = 14,
  diagnostics,
  label,
  minHeight,
  onRun,
  onTest,
  onSave,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const compartments = useRef({
    language: new Compartment(),
    readOnly: new Compartment(),
    tabSize: new Compartment(),
  });
  // Keep latest callbacks without reconfiguring the editor on every render.
  const callbacks = useRef({ onChange, onRun, onTest, onSave });
  useLayoutEffect(() => {
    callbacks.current = { onChange, onRun, onTest, onSave };
  });

  useEffect(() => {
    if (!host.current) return;
    const c = compartments.current;
    const run = (key: keyof EditorShortcuts) => () => {
      const fn = callbacks.current[key];
      if (!fn) return false;
      fn();
      return true;
    };
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ activateOnTyping: false }),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      lintGutter(),
      keymap.of([
        { key: "Mod-Enter", run: run("onRun"), preventDefault: true },
        { key: "Mod-Shift-Enter", run: run("onTest"), preventDefault: true },
        { key: "Mod-s", run: run("onSave"), preventDefault: true },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      editorTheme,
      highlightStyle,
      c.language.of([]),
      c.readOnly.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
      c.tabSize.of([EditorState.tabSize.of(tabSize), indentUnit.of(" ".repeat(tabSize))]),
      EditorView.contentAttributes.of({ "aria-label": label }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.current.onChange?.(update.state.doc.toString());
      }),
    ];
    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: value, extensions }),
    });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    // The view is created once; later prop changes flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes (reset, switching attempts) replace the document.
  useEffect(() => {
    const instance = view.current;
    if (instance && instance.state.doc.toString() !== value) {
      instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    void EDITOR_MODES[language]().then((extension) => {
      if (!cancelled)
        view.current?.dispatch({ effects: compartments.current.language.reconfigure(extension) });
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.readOnly.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.tabSize.reconfigure([
        EditorState.tabSize.of(tabSize),
        indentUnit.of(" ".repeat(tabSize)),
      ]),
    });
  }, [tabSize]);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    const doc = instance.state.doc;
    const markers: CmDiagnostic[] = (diagnostics ?? [])
      .filter((d) => d.line !== undefined && d.line <= doc.lines)
      .map((d) => {
        const line = doc.line(d.line ?? 1);
        const from = Math.min(line.from + Math.max((d.column ?? 1) - 1, 0), line.to);
        return { from, to: Math.max(from, line.to), severity: d.severity, message: d.message };
      });
    instance.dispatch(setDiagnostics(instance.state, markers));
  }, [diagnostics, value]);

  return (
    <div
      ref={host}
      className={styles.editor}
      style={{ ["--editor-font-size" as string]: `${fontSize}px`, minHeight }}
      data-language={language}
    />
  );
}
