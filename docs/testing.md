# Testing

Testing is layered so that most behaviour is verified quickly and deterministically, and the browser-only behaviour gets real-browser coverage. See [ADR-007](adr/007-testing-strategy.md).

```bash
npm test               # Vitest: unit, component, integration, runtime, regression
npm run test:e2e       # Playwright: production build served under /code-challenge/
PW_CHANNEL=chrome npm run test:e2e   # use a locally installed Chrome
```

## Layers

| Layer                 | Where                                    | What it proves                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                  | `src/**/*.test.ts`                       | Domain rules (lifecycle, filtering, stats, fingerprints, export format), schemas, prompt building, JSON extraction, provider HTTP handling, the output buffer, the result protocol, the `expect` library, loop guards, Markdown safety, the repository (with `fake-indexeddb`).                                                                                                                                            |
| Host/runtime protocol | `src/runtimes/core/sandbox-host.test.ts` | Timeout → destroy → respawn, cancellation, crash handling, output caps, init retry, request serialisation and timeout attribution. These run over a real `MessageChannel` using an in-process endpoint.                                                                                                                                                                                                                    |
| Runtime contract      | `tests/runtime/*.test.ts(x)`             | Every language handler passes `describeRuntimeContract`: stdout, stderr, compile errors, runtime errors, and for every fixture, _reference passes all tests_ and _starter does not_. They run against the **real toolchains in Node**: CPython (Pyodide), PHP 8.4 (the php-wasm Node build of the same binary) and clang/LLVM (`@yowasp/clang`). React runs in jsdom.                                                      |
| Generation pipeline   | `src/services/generation/*.test.ts`      | End to end with a scripted provider and the real TypeScript runtime: acceptance, repair after malformed JSON, repair after a failing reference, the attempt budget, duplicate rejection, retry on transient errors only.                                                                                                                                                                                                   |
| Regression            | `tests/regression/`                      | One named test per bug found during development, each with a header explaining the bug ([index](../tests/regression/README.md)).                                                                                                                                                                                                                                                                                           |
| End to end            | `tests/e2e/*.spec.ts`                    | In real Chromium against the production build under a non-root base path: generate, solve, persist across reload, run output, errors and timeouts, portfolio and reference reveal, backup → clear → import round-trip, the unsaved-changes guard, React preview and Testing Library, sandbox isolation probes, Python/PHP/C/C++ compile-run-test flows, timeout and recovery, viewport fit, deep links, and mobile layout. |

## Determinism

- **Generation:** tests never call an LLM. They use `ScriptedProvider` (replayed responses) or the sample source.
- **Time:** domain functions take `now`; test factories use fixed dates.
- **Fixtures:** `fixtures/challenges/*.ts` are validated by the schema at import and by the runtime contract. They're for tests, development and offline demos, not a production challenge pool.

## CI

The `verify` job runs format, typecheck, lint, the Vitest suite and a production-dependency audit. `build` and `e2e` run afterwards. The E2E job installs Chromium with `playwright install --with-deps`.

The heavy toolchains run in CI too:

- **Runtime contract tests:** the clang, PHP and Pyodide suites run inside Vitest and take seconds once `node_modules` is installed.
- **E2E:** the Playwright suite exercises the C/C++ toolchain from the built site. The first compile downloads about 105 MB locally, and the tests allow for that.
