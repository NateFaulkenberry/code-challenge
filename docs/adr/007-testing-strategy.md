# ADR-007: Testing Strategy

## Status

Accepted — 2026-09-23

## Context

The test suite is part of the portfolio. It has to be deterministic in CI even though generation is LLM-driven and some runtimes download tens of megabytes.

## Decision

| Layer       | Tool                                                                       | Scope                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest (node/jsdom)                                                        | schemas, lifecycle, filtering, stats, fingerprinting, prompt building, result normalisation, repository (via `fake-indexeddb`), import/export |
| Component   | Vitest + Testing Library                                                   | UI states, dialogs, accessibility roles                                                                                                       |
| Integration | Vitest                                                                     | generate → validate → display → edit → run → pass → persist, using `FixtureProvider` and a `FakeRuntime`                                      |
| Runtime     | Vitest (Node, same worker handlers) + Playwright for browser-only runtimes | per-language contract suite: stdout, stderr, success, compile error, runtime error, timeout, malformed code, truncation                       |
| E2E         | Playwright (Chromium)                                                      | generate, solve, persist, import/export, portfolio mode, against the production build under a non-root base path                              |
| Regression  | `tests/regression/`                                                        | one named test per fixed bug                                                                                                                  |

Heavy runtime tests (C/C++/Java/PHP/Python) are tagged and run in a separate CI job with cached assets, so a flaky download never blocks the fast suite. The split is visible in the CI summary; nothing is silently skipped.

## Alternatives Considered

- **Jest**: slower ESM story in a Vite project.
- **Cypress**: heavier; Playwright's multi-browser support and trace viewer are better suited here.

## Consequences

- Runtime handlers are written to be host-agnostic (pure functions over a small environment) so they can be tested in Node without a browser.
- The fake runtime must honour the real contract, which the shared contract suite enforces.
