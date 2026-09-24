# ADR-003: Language Runtime Architecture

## Status

Accepted — 2026-09-23

## Context

Language-specific logic must not leak into UI components, adding a language should not require rewriting the app, and a future remote execution provider must fit without changes to the UI.

## Decision

1. A **typed language registry** (`src/domain/languages.ts`) is the only place languages are enumerated. Each entry declares a label, file extension, editor mode loader, runtime loader, capabilities (e.g. `preview`) and generation constraints.
2. A single **`LanguageRuntime` interface** (`initialize`, `execute`, `runTests`, `dispose`, `isSupported`) with `kind: "browser" | "remote"`.
3. One reusable host, **`SandboxRuntime`**, provides the lifecycle, typed request/response messages over a private `MessagePort`, timeout → destroy → lazy respawn, cancellation and output caps. Endpoint factories adapt it to a Web Worker (`workerEndpoint`) or a sandboxed iframe (`createIframeEndpoint`).
4. Each language contributes only a **worker entry** implementing `RuntimeHandler` (`init`, `execute`, `runTests`) plus a **test harness** that emits the common result protocol.
5. `ExecutionService` caches one runtime per language and exposes status to the UI.

## Alternatives Considered

- **One mega-worker for all languages.** It would load every toolchain together and a crash would affect all languages.
- **A per-language UI branch** (`if (lang === "react") …`). This is the scattering the spec forbids. The only capability-driven UI difference is showing a preview pane when `capabilities.preview` is set.

## Consequences

- Adding a language takes a registry entry, a worker entry, a harness and runtime tests.
- A `RemoteRuntime` could implement the same interface over HTTP later.
- The contract is enforced by one shared runtime contract test suite run against each adapter.
