# ADR-002: Browser Code Execution Strategy

## Status

Accepted — 2026-09-23

## Context

Seven languages must execute in the browser without a backend. The main thread has to stay responsive, and user code must not reach application state. Research findings are in [research.md](../research.md).

## Decision

| Language   | Toolchain                                                           | Host                             |
| ---------- | ------------------------------------------------------------------- | -------------------------------- |
| TypeScript | sucrase (TS → JS) + `new Function` inside the worker                | Web Worker                       |
| React      | sucrase (TSX → JS), React 19 + Testing Library bundle               | Sandboxed iframe (opaque origin) |
| Python     | Pyodide 314 (CPython 3.14)                                          | Web Worker                       |
| PHP        | `@php-wasm/web` (PHP 8.4)                                           | Web Worker                       |
| C          | `@yowasp/clang` (LLVM 22, `-std=c17`) + `@bjorn3/browser_wasi_shim` | Web Worker                       |
| C++        | same, `-std=c++20 -fno-exceptions`                                  | Web Worker                       |
| Java       | Deferred — see [ADR-017](017-java-runtime.md)                       | —                                |

Every runtime is loaded on demand. Every execution has a wall-clock timeout that terminates the worker or iframe.

## Alternatives Considered

- **`eval` on the main thread**: rejected. There is no isolation and a `while(true)` freezes the UI.
- **CheerpJ for Java**: full JDK, but free use requires loading from the vendor CDN, and in-browser `javac` is limited to Java 8.
- **Interpreters (JSCPP, picoc)**: accept only language subsets. Presenting them as C/C++ would misrepresent the language.
- **SharedArrayBuffer-based interrupts** (Pyodide, Wasmer): these need COOP/COEP headers that Pages cannot send. `coi-serviceworker` could supply them, but it adds a forced reload and CORP requirements for a benefit (cheaper interruption) that termination already provides.

## Consequences

- C++ has no exception support. It is documented and fed into generation constraints. Java is deferred ([ADR-017](017-java-runtime.md)).
- The first use of C/C++ downloads about 27 MB. Progress is shown and the browser HTTP cache keeps the files afterwards.
- After a timeout the runtime must re-initialise (a few seconds for Pyodide or PHP).
