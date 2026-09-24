# Coding Challenge Lab

**A personal coding-challenge environment that generates realistic engineering challenges, then compiles, runs and tests your solution entirely in the browser.**

TypeScript · React · Python · PHP · C · C++ run client-side (Web Workers, WebAssembly, a sandboxed iframe) on a static GitHub Pages site with no backend.

> Built as a portfolio piece: the app shows my completed challenges and solutions, and the repository shows how I build software (architecture, tests, ADRs and documented trade-offs).

---

## What it does

- **Generates challenges on demand** with an LLM: pick a language and a difficulty, or let it choose. Challenges are modelled on real work (caches, parsers, UI components, data pipelines), not trivia.
- **Refuses to trust the generator.** Every generated challenge is schema-validated and statically checked for anything its runtime can't support. Its reference solution is then _executed against its own tests in the browser runtime_. Invalid challenges go back to the model with the validator's findings, up to a bounded number of repair attempts.
- **Runs your code for real.** CPython 3.14 (Pyodide), PHP 8.4 (php-wasm), and clang/LLVM 22 compiling C17 and C++20 to WebAssembly. TypeScript runs in an isolated Worker, and React renders in an opaque-origin sandbox with Testing Library.
- **Separates visible and hidden tests.** Only a submission that passes every test marks a challenge complete.
- **Keeps your history locally** in IndexedDB, with a _My Challenges_ library, search and filters, stats derived from real data, and JSON import/export.
- **Has a portfolio mode.** Completed work is shown read-only as Problem → Approach → Solution → Tests → Result, with the reference solution behind a confirmation and an optional side-by-side comparison.

## Try it

- **No setup needed:** the site starts in _sample mode_, which uses a small bundled set of challenges (one per language) so every runtime can be tried offline.
- **Unlimited generation:** add an Anthropic API key in **Settings**. The key stays in your browser; see [Security](docs/security.md) for what that means.
- **Local only — Claude subscription:** when running the app locally, `npm run dev:claude` adds a **Claude — Local Only** provider that uses your own Claude Pro/Max subscription through the official Claude Agent SDK, with no API key. It isn't part of the public site. See [docs/local-claude.md](docs/local-claude.md).

## Architecture at a glance

```text
React UI ──► services ──► ChallengeSource ──► LlmProvider (BYOK / proxy)    ──► validation pipeline
                      ├─► ExecutionService ─► LanguageRuntime (lazy)        ──► Worker / sandboxed iframe
                      └─► AttemptStore ─────► ChallengeRepository (IndexedDB)
```

- **One runtime contract.** Every language implements `LanguageRuntime` (`initialize · execute · runTests · dispose`). A generic `SandboxRuntime` host owns timeouts, cancellation, output caps and crash recovery. Each language supplies only a worker entry and a test harness ([ADR-003](docs/adr/003-language-runtime-architecture.md)).
- **Tests are code, not I/O pairs.** Each language has a tiny assertion harness that reports results through one protocol, so the UI sees a single `TestResult` shape ([ADR-011](docs/adr/011-test-model.md)).
- **Schema-first domain.** Zod schemas are the single source of truth for types, runtime validation of LLM output and imports, and the JSON Schema sent to the model.
- **No runtime in the initial bundle.** The app shell is about 161 KB gzipped, and toolchains load only when a language is first used ([ADR-010](docs/adr/010-runtime-lazy-loading-strategy.md)).

See [docs/architecture.md](docs/architecture.md) for the full design and [docs/research.md](docs/research.md) for the feasibility study behind it.

## Languages

| Language   | Runtime                                  | Isolation                        | First-use download |
| ---------- | ---------------------------------------- | -------------------------------- | ------------------ |
| TypeScript | sucrase → JS                             | Web Worker                       | ~100 KB            |
| React      | React 19 + Testing Library               | Sandboxed iframe (opaque origin) | ~270 KB            |
| Python     | Pyodide 314 (CPython 3.14)               | Web Worker                       | ~6 MB              |
| PHP        | php-wasm (PHP 8.4)                       | Web Worker                       | ~8 MB              |
| C / C++    | clang/LLVM 22 → wasm32-wasip1, WASI shim | Web Worker                       | ~27 MB (cached)    |
| Java       | Not available yet (licensing, see below) | —                                | —                  |

Per-language limitations are documented in [docs/runtimes.md](docs/runtimes.md).

## Running locally

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # unit, integration, runtime and regression tests (Vitest)
npm run test:e2e       # Playwright against the production build under /code-challenge/
npm run build          # static site in dist/
```

With Docker (Node 24):

```bash
docker compose up                       # dev server on :5173
docker compose run --rm app test        # test suite
docker compose run --rm app build       # production build
docker compose run --rm e2e             # Playwright in Microsoft's browser image
```

More in [docs/development.md](docs/development.md).

## Testing

About 270 Vitest tests and 20 Playwright scenarios cover the following:

- **Runtime contract:** every language handler passes the same contract suite, run against the _real_ toolchains in Node (CPython, PHP and clang WebAssembly builds).
- **Fixtures:** each fixture's reference passes all of its tests, and its starter does not.
- **Browser end to end:** generate, solve, persist across reload, import/export round-trip, portfolio mode, sandbox isolation probes, timeouts, responsive layout, and axe accessibility checks in light and dark themes.
- **Regressions:** every bug found during development has a named regression test ([tests/regression/](tests/regression/)).

See [docs/testing.md](docs/testing.md).

## Deployment

GitHub Actions runs format, typecheck, lint and tests, then builds and runs E2E. A separate workflow deploys to GitHub Pages only after CI succeeds on `main`. The base path comes from `actions/configure-pages`, so the site works at `user.github.io/<repo>/` or on a custom domain. See [docs/deployment.md](docs/deployment.md).

## Known limitations

- **Hidden tests aren't secret.** Everything ships to the browser; this is a practice and portfolio tool, not a proctored grader.
- **C++ has no exceptions.** It compiles with `-fno-exceptions`, because the WebAssembly libc++ build has no unwinder.
- **Java is not available.** The only mature in-browser `javac` (TeaVM) has no explicit license for redistributing its compiled binaries. See [ADR-017](docs/adr/017-java-runtime.md).
- **TypeScript types are erased, not checked.** There is no in-editor IntelliSense.
- **Python is stdlib only.** It has no threads and no blocking `input()` in tests.
- **Timeouts are expensive for WebAssembly runtimes.** A timeout terminates the worker, and Python, PHP and C/C++ then need to re-initialise.

## Documentation

[Architecture](docs/architecture.md) · [Research report](docs/research.md) · [Runtimes](docs/runtimes.md) · [Challenge generation](docs/challenge-generation.md) · [Security](docs/security.md) · [Testing](docs/testing.md) · [Development](docs/development.md) · [Deployment](docs/deployment.md) · [Local Claude](docs/local-claude.md) · [ADRs](docs/adr/)
