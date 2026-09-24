# Language Runtimes

Every language implements the same `LanguageRuntime` contract (`src/runtimes/core/types.ts`). A generic host, `SandboxRuntime`, owns the parts every language shares:

- lazy creation of an isolated endpoint (Web Worker or sandboxed iframe), connected over a private `MessageChannel`;
- one request at a time;
- a wall-clock timeout, after which the endpoint is destroyed and lazily recreated;
- cancellation through `AbortSignal`;
- stdout/stderr capped at 64 KB each, enforced on both sides of the channel;
- crashes reported as `internal-error` results, never as thrown exceptions.

A language contributes a **handler**: `init`, `execute` and `runTests`, written host-agnostically so the same code runs in the browser worker and in Node tests. It also contributes a **test harness** that reports results through the shared protocol.

## Summary

| Language   | Toolchain                                                      | Host                               | Assets (self-hosted)                                       | Test harness                                          |
| ---------- | -------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| TypeScript | sucrase 3.35 → CommonJS, `new Function`                        | Worker                             | bundled (~100 KB gz)                                       | Jest-style `expect`, `fn`, `sleep`                    |
| React      | sucrase (TSX), React 19 **development** build, Testing Library | `<iframe sandbox="allow-scripts">` | `sandbox.html` (~270 KB gz)                                | Testing Library + DOM matchers                        |
| Python     | Pyodide 314.0.7 (CPython 3.14)                                 | Worker                             | `runtimes/python/<ver>/` (~6 MB transfer)                  | plain `assert`, with operand values shown             |
| PHP        | `@php-wasm/web-8-4` 3.1 (PHP 8.4.25)                           | Worker                             | hashed assets (~8 MB transfer; one of two variants)        | `assert_same`, `assert_equals`, `assert_throws`, …    |
| C          | `@yowasp/clang` 22 (`-std=c17`) + `@bjorn3/browser_wasi_shim`  | Worker                             | `runtimes/clang/<ver>/` (~27 MB transfer, shared with C++) | `CHECK`, `CHECK_EQ_INT`, `CHECK_EQ_STR`, `CHECK_NEAR` |
| C++        | same (`-std=c++20 -fno-exceptions`)                            | Worker                             | shared                                                     | the C macros plus generic `CHECK_EQ`                  |
| Java       | —                                                              | —                                  | —                                                          | Not available; see [ADR-017](adr/017-java-runtime.md) |

## TypeScript

- User code is transpiled by sucrase (types stripped, ESM → CJS), then parsed by acorn. Acorn serves as a stricter syntax check and also instruments loops (below).
- The only importable module is `./solution` (from tests). Anything else fails with a clear error.
- **Run** waits until pending timers drain, so `setTimeout` output appears. Unhandled rejections become runtime errors.
- Each test re-evaluates the solution module, so module state can't leak between tests. Each test has a 2 s async limit.
- **Loop guards:** every loop checks a time budget (5 s), so an infinite loop fails its test with a clear message instead of timing out the whole run.
- **Limitation:** types are erased, not checked.

## React

- **Isolation:** the iframe has no `allow-same-origin`, so its origin is opaque. It cannot touch the parent DOM, localStorage, IndexedDB or cookies, cannot navigate the top window, and cannot open popups. The E2E suite probes each of these.
- **Production CSP:** the production `sandbox.html` carries a CSP `<meta>` (`connect-src 'none'`, `frame-src 'none'`, `worker-src 'none'`, …), which code inside cannot relax.
- **Development React build (on purpose):** React's production build has no `act()`, which Testing Library requires. The sandbox is therefore a separate Vite build using development React, which also gives users component stacks and warnings ([ADR-015](adr/015-react-sandbox-development-build.md)).
- **Preview:** the preview renders the default export with no props. Tests clear the preview first, so queries see only test renders.
- **Loop guards (1 s):** sandboxed iframes may share the page's thread in some browsers, so these guards are the primary defence against freezing the app ([ADR-016](adr/016-loop-guards.md)).
- **Offscreen when hidden:** the preview iframe is moved offscreen rather than hidden with `display:none`, because elements inside a non-rendered iframe cannot take focus (see [the regression note](../tests/regression/README.md)).

## Python

- **Assets:** Pyodide is copied from `node_modules` into `public/runtimes/python/<version>/` by `scripts/copy-runtime-assets.mjs` and loaded from the site itself, with no CDN dependency.
- **Filesystem:** solutions are written to `/work/solution.py`. **Run** uses `runpy` with `__name__ == "__main__"`, and stdin is supported.
- **Isolation:** each test runs in a fresh namespace with a fresh `import solution`.
- **Failure messages:** a failing bare `assert x == y` shows the failing line and, for side-effect-free operands, both values.
- **Tracebacks:** these are filtered to the user's own frames.
- **Blocked modules:** `js` and `pyodide_js` (the bridges into the JavaScript realm) are blocked by a `sys.meta_path` hook.
- **Timeouts:** there is no `SharedArrayBuffer` on GitHub Pages (no COOP/COEP headers), so Pyodide's interrupt buffer can't be used. A timeout terminates the worker, and the next run starts a new interpreter in about 1–2 s once cached.
- **Limitations:** standard library only; no threads, subprocesses, sockets or blocking `input()` in tests.

## PHP

- **Build variants:** the per-version package `@php-wasm/web-8-4` is used instead of `@php-wasm/web`, which would bundle every PHP version. It ships a JSPI and an asyncify build, and the browser downloads only the one it supports.
- **Vite plugin:** a small plugin (`phpWasmAssets` in `vite.config.ts`) rewrites the loader's bare `.wasm` imports to `?url` assets.
- **Clean errors:** the `wasm` SAPI behaves like a web server, so `display_errors` is off. Errors arrive as clean text on stderr, never as HTML in stdout.
- **Syntax checks:** these use `token_get_all(..., TOKEN_PARSE)`, which validates without executing anything.
- **Isolation:** each test is a separate PHP request, so functions, classes and statics are fresh.
- **Limitations:** core extensions only; no network, database or Composer. Infinite loops end only by worker termination.

## C and C++

- **Assets:** the clang toolchain (LLVM 22, wasi-libc and libc++) is self-hosted _unbundled_. Its `bundle.js` resolves about 105 MB of wasm and resources relative to itself; they are downloaded once and then served from the HTTP cache. `init` warms the compiler with a trivial compile.
- **Run:** compiles the solution alone, and requires `int main()`.
- **Tests:** compile once, in one translation unit: harness header + solution (its `main` renamed) + prelude + one function per test + a dispatching `main`. `#line` directives make compiler errors and `__LINE__` relative to each test.
- **Isolation:** every test runs in a **fresh WebAssembly instance** of the compiled module, so globals are reset and a trap (null dereference, `abort()`, out-of-bounds access) fails only that test.
- **Limitations:** no C++ exceptions (the libc++ build has no unwinder, so everything compiles with `-fno-exceptions`); no threads, sockets or files; about 1 MB of stack. Compiling takes about 1–4 s.

## Java

Not available. See [ADR-017](adr/017-java-runtime.md) for the options evaluated and the open licensing question. The registry marks Java as _planned_: the UI says it's unavailable, and generation refuses it. It never fakes execution.

## Adding a language

1. Add the id to `LANGUAGE_IDS` and an entry to `LANGUAGES` (`src/domain/languages.ts`). The compiler then points out every `Record<LanguageId, …>` that needs a value: editor mode, runtime registry, affinity taxonomy and language rules.
2. Write a handler (`init`, `execute`, `runTests`) and a harness that emits the result protocol (`src/runtimes/core/test-protocol.ts`).
3. Add a worker entry and a `create<Lang>Runtime()` that wraps a `SandboxRuntime`.
4. Add `prompts/harness-v1/<lang>.md` so the generator knows the assertion API.
5. Add a fixture and a runtime test calling `describeRuntimeContract`.
