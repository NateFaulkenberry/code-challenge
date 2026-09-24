# ADR-012: Code Editor — CodeMirror 6

## Status

Accepted — 2026-09-23

## Context

The editor needs highlighting for seven languages, search, keyboard shortcuts, themes, accessibility and good behaviour on small screens, with a modest bundle.

## Decision

Use **CodeMirror 6** with an in-house `<CodeEditor>` React wrapper (~100 lines). Language modes load lazily through the language registry. Themes follow the app's CSS custom properties, so light and dark modes are automatic. Diagnostics from compile errors map to CodeMirror lint markers where line numbers are available.

## Alternatives Considered

- **Monaco**: VS Code-grade IntelliSense, but multi-MB, needs worker setup, and is officially unsupported on mobile.
- **`@uiw/react-codemirror`**: convenient, but a dependency for what is a thin integration layer.

## Consequences

- No TypeScript IntelliSense in the editor. Acceptable, since challenges are self-contained.
- Mobile editing works.
