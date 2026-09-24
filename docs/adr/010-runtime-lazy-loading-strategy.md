# ADR-010: Runtime Lazy Loading Strategy

## Status

Accepted — 2026-09-23

## Context

Runtime payloads range from about 60 KB (sucrase) to about 27 MB (clang). Loading them at startup would make the app unusable on first visit.

## Decision

- The app shell contains no runtime code. Each language's runtime and editor mode sit behind dynamic `import()` in the registry, so Vite emits separate chunks.
- Toolchain binaries (Pyodide, PHP wasm, clang, TeaVM) are **self-hosted static assets**, copied into `dist/runtimes/<lang>/` at build time by `scripts/copy-runtime-assets.mjs` and fetched only by that language's worker.
- A runtime initialises when first needed (Run, Test, or challenge validation). A small idle-time prewarm starts for the current challenge's language after the workspace renders.
- Progress (`downloading`, `initializing`, `ready`) is reported through the runtime status, and the UI shows it.
- Caching relies on HTTP caching of immutable, versioned asset paths, and a compiled `WebAssembly.Module` is reused within a worker's lifetime.

## Alternatives Considered

- **A Service Worker precache**: offline-friendly, but precaching 40+ MB is hostile. Could come later as opt-in per-language offline packs.
- **CDN-hosted runtimes (jsDelivr)**: jsDelivr's 20 MB per-file limit excludes clang, and self-hosting avoids a third-party runtime dependency.

## Consequences

- The initial JS bundle stays small (budget: < 250 KB gz for shell and editor core).
- The first run of a heavy language has a noticeable, clearly communicated delay.
