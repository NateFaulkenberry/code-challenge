# ADR-006: Code Execution Security Model

## Status

Accepted — 2026-09-23

## Context

User solutions, imported challenges and LLM-generated code are untrusted. The app stores an optional API key and the user's history on the same origin.

## Decision

- **No untrusted code runs in the application's realm.**
  - Workers: separate global, no DOM, no `localStorage`. IndexedDB is technically reachable from same-origin workers, so a pre-execution prelude deletes `indexedDB`, `caches`, `fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts` and `BroadcastChannel` from the worker's global scope before user code runs.
  - React: iframe with `sandbox="allow-scripts"` and **no** `allow-same-origin`, which gives an opaque origin with no access to parent DOM, storage or cookies, and no top-level navigation. A CSP `<meta>` inside the sandbox restricts `connect-src` to `'none'`.
- **Resource limits:** a wall-clock timeout (default 10 s, configurable) terminates the worker or iframe. stdout/stderr are capped at 64 KB each and further output is dropped and flagged. Message payloads are size-checked.
- **Rendering:** challenge text is Markdown rendered by a minimal in-house renderer that escapes HTML. No `dangerouslySetInnerHTML` with untrusted content.
- **Imports:** validated with Zod, size-limited, and never executed on import.
- **API key:** stored locally only after an explicit warning, never logged, never exported, and sent only to the configured provider.

## Alternatives Considered

- **Same-origin iframe for React.** Simpler, but it gives user code full access to `parent`.
- **Separate origin for the sandbox** (e.g. a second Pages site). Stronger, but the opaque-origin iframe already achieves the needed isolation.

## Consequences

- **Not guaranteed:** hidden tests and reference solutions are readable by anyone with devtools. The app is a practice and portfolio tool, not a secure grading system.
- WASM memory exhaustion can still crash a worker. That is caught as a crash and the worker is re-spawned.
- Removing globals is defence in depth, not a security boundary. The worker's separate realm and termination are the real controls.
