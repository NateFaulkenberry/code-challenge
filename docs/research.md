# Technical Research Report

_Research pass completed 2026-09-23. Versions were read from the npm registry and project release pages on that date. Sizes marked "br"/"gz" are compressed transfer sizes; "unpacked" is npm install size._

This report records the feasibility investigation that preceded implementation. The decisions it led to are captured in [`adr/`](adr/); this document preserves the evidence.

## 1. Hard constraints

| Constraint                  | Consequence                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployed to GitHub Pages    | Static files only. No server code, no custom HTTP headers.                                                                                     |
| No custom headers           | No `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`, so no `SharedArrayBuffer` unless the `coi-serviceworker` workaround is used. |
| Project-page URL (`/repo/`) | Every asset URL must respect a configurable base path. History-API routing breaks on deep links.                                               |
| Public site                 | No private API key may ever be shipped.                                                                                                        |
| Untrusted user and LLM code | All execution must be isolated from the application origin/state.                                                                              |

## 2. Language runtimes

### 2.1 JavaScript / TypeScript

| Option                             | Payload                         | Notes                                                                                                |
| ---------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **sucrase 3.35**                   | ~1.1 MB unpacked, ~60 KB min+gz | Pure JS. Strips types, transforms JSX and ESM→CJS. No type checking. Very fast.                      |
| `typescript@6.0` `transpileModule` | ~900 KB gz                      | Most faithful; heavy; slow cold parse.                                                               |
| `typescript@7`                     | n/a                             | **Now the Go-native compiler.** No browser JS API; also unsupported by `typescript-eslint` (`<6.1`). |
| esbuild-wasm 0.28                  | ~3–4 MB gz                      | Fast after init, can bundle. Overkill here.                                                          |
| @swc/wasm-web                      | ~15 MB wasm                     | Heaviest.                                                                                            |

**Selected:** sucrase inside a dedicated Web Worker. The worker has no DOM, no `localStorage`, no access to the app's JS heap, and is terminated on timeout. Type checking is out of scope for execution (documented limitation); `typescript@6.0` is the dev-time compiler for the project itself.

### 2.2 React

React challenges need a DOM, so a Worker is insufficient. Selected model:

- A **sandboxed `<iframe sandbox="allow-scripts">`** (no `allow-same-origin`) gives the preview an **opaque origin**: it cannot read the parent's DOM, `localStorage`, IndexedDB or cookies, and cannot navigate the top window.
- The iframe loads a separately-built `sandbox.html` entry that bundles React 19, ReactDOM and `@testing-library/react` + `@testing-library/user-event`. This bundle is only fetched for React challenges.
- User TSX is transpiled with sucrase and evaluated inside the iframe. Communication is `postMessage` over a `MessageChannel`, with the parent verifying `event.source`.
- Tests are written against Testing Library, an API LLMs generate reliably and that exercises clicks, typing, keyboard and async behaviour.
- Timeout: the iframe element is removed and recreated (its event loop dies with it).

### 2.3 Python — Pyodide

- `pyodide` **314.0.7** (CPython 3.14.2). Core download ≈ **6.2 MB br** (wasm 3.4 MB, stdlib zip 2.5 MB).
- Cold init ≈ 2–5 s, cached ≈ 1–2 s. Runs in a module Web Worker.
- stdout/stderr via `setStdout`/`setStderr({ batched })`. Virtual FS (`pyodide.FS`) supports writing `solution.py` and importing it from tests.
- Interrupts need `SharedArrayBuffer` (COOP/COEP) — unavailable on Pages without a service-worker shim. **Timeouts use `worker.terminate()` and a fresh worker** instead; cost is re-initialisation after a timeout only.
- Packages: pure stdlib only. The generator is instructed not to use third-party packages; semantic validation rejects imports outside an allow-list.
- Self-hosted (copied from `node_modules` at build time) so the app does not depend on a CDN at runtime.

### 2.4 PHP — php-wasm

| Option                                           | Payload             | Notes                                                                |
| ------------------------------------------------ | ------------------- | -------------------------------------------------------------------- |
| **`@php-wasm/web` 3.1.x** (WordPress Playground) | PHP 8.4 ≈ 7.2 MB br | Weekly releases, bundler-oriented, used in production by Playground. |
| `php-wasm` 0.1.0 (Sean Morris)                   | ≈ 3.0 MB br         | Smaller, infrequent releases.                                        |

Real PHP executes client-side — no translation. **Selected:** `@php-wasm/web` (maintenance and API quality), with PHP 8.4 only. No sockets/network; no interruption of infinite loops except by worker termination.

### 2.5 C / C++ — clang in WebAssembly

| Option                         | Status                                   | Notes                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@yowasp/clang` 22.0.0-git** | ISC; repo archived (frozen build, works) | LLVM 22, wasi-libc + libc++, C17/C++20 verified. ≈ 27 MB gz. ~3 s per compile. **No C++ exceptions** (`__cxa_throw` unresolved) → must compile with `-fno-exceptions`. |
| binji/wasm-clang               | stale (2023)                             | Old LLVM, ≤ C++17.                                                                                                                                                     |
| Wasmer clang                   | active                                   | Needs WASIX + SharedArrayBuffer → COOP/COEP.                                                                                                                           |
| JSCPP, picoc, TinyCC           | —                                        | Subsets, dead, or emit non-wasm code.                                                                                                                                  |

**Selected:** `@yowasp/clang` for compilation, `@bjorn3/browser_wasi_shim` 0.4 to run the produced `wasm32-wasip1` module. Both compile and execution happen in a Worker. Limitations surfaced to users and to the generator prompt: no exceptions, no threads, no filesystem beyond stdin/stdout.

### 2.6 Java

| Option                             | Status                                                     | Notes                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **TeaVM javac playground**         | Apache-2.0 (+ GPLv2-CPE OpenJDK parts), active             | javac (21) + TeaVM AOT compiled to Wasm-GC; ≈ 7 MB; worker protocol built in. Partial JDK class library; limited reflection; no real threads. |
| CheerpJ 4.3                        | Proprietary; free for personal use **only from their CDN** | Full JVM (Java 8/11/17); in-browser javac only via JDK 8 `tools.jar`; DOM-oriented console.                                                   |
| DoppioJVM, JWebAssembly, Bytecoder | dead / AOT only                                            | No in-browser compilation.                                                                                                                    |

**Selected:** TeaVM javac, self-hosted and pinned by checksum. **Documented limitation:** only TeaVM's class-library subset is available and `java.util.concurrent`-style threading is not; Java challenges are generated with those constraints. The spec's "thread-safe task queue" example is therefore out of scope for Java execution and is noted as such.

## 3. Code editor

|           | CodeMirror 6                                                                   | Monaco 0.56            |
| --------- | ------------------------------------------------------------------------------ | ---------------------- |
| Size      | ~100–150 KB gz (setup + a language)                                            | Several MB + workers   |
| Mobile    | Supported                                                                      | Officially unsupported |
| Languages | `lang-javascript` (TS/TSX), `lang-python`, `lang-cpp`, `lang-java`, `lang-php` | All                    |
| Workers   | None needed                                                                    | Required               |

**Selected:** CodeMirror 6 with a small in-house React wrapper (no `@uiw/react-codemirror` — the wrapper is ~100 lines and avoids a dependency).

## 4. Persistence

- **IndexedDB via `idb` 8** (~1.2 KB gz). The data model has a handful of stores keyed by id; Dexie's query/reactivity layer (~25 KB) is not needed.
- `localStorage` only for small preferences and the (optional, BYOK) API key, which is **excluded from exports**.

## 5. LLM APIs from the browser

- **Anthropic:** supports CORS when the request carries `anthropic-dangerous-direct-browser-access: true`. Structured output via `output_config.format` with a JSON Schema (derived from the Zod schema with `z.toJSONSchema()`).
- **OpenAI:** preflight from a `github.io` origin succeeds, but browser access is not officially documented — treated as best effort.
- Called with `fetch` directly; no SDK dependency.

## 6. GitHub Pages

- No custom headers (COOP/COEP) — confirmed open feature request.
- Routing: **hash router** (`/#/challenges/abc`) is robust on Pages; the `404.html` trick returns HTTP 404 for deep links.
- Base path: Vite `base` set from `BASE_PATH` env (CI uses `actions/configure-pages` output); runtime asset URLs derive from `import.meta.env.BASE_URL`.
- Actions: `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`.

## 7. Validation

- **Zod 4.6** for runtime validation of LLM output, imports and IndexedDB records; the same schemas produce the JSON Schema sent to the LLM.

## 8. Open questions carried into implementation

1. TeaVM's stdout routing inside a Worker needs to be verified against the actual build.
2. `@yowasp/clang` resource loading under Vite (large `.wasm` + `.tar` resolved via `import.meta.url`).
3. Pages serves ~75 MB `llvm.core.wasm` — within limits, but first-load UX must show progress.
