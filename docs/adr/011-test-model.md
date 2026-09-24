# ADR-011: Test Model — Tests as Language-Native Code

## Status

Accepted — 2026-09-23

## Context

The suggested `{ input, expectedOutput }` test model fits pure functions only. Realistic challenges test behaviour: concurrency deduplication, stale response handling, resource cleanup, UI interaction. Each language also has its own idioms for asserting.

## Decision

A challenge carries a `TestSuite { prelude: string; cases: TestCase[] }`. `TestCase.code` is a test body in the challenge's language, written against a minimal harness:

| Language   | Assertion API                                                                    |
| ---------- | -------------------------------------------------------------------------------- |
| TypeScript | `expect(x).toBe/toEqual/toThrow/…` (Jest-like subset, async supported)           |
| React      | Testing Library (`render`, `screen`, `userEvent`, `waitFor`) + the same `expect` |
| Python     | plain `assert`                                                                   |
| PHP        | `assert_equals($expected, $actual)`, `assert_true`, `assert_throws`              |
| C / C++    | `CHECK(cond)`, `CHECK_EQ_INT(a,b)`, `CHECK_EQ_STR(a,b)` macros                   |
| Java       | `Assert.equals(expected, actual)`, `Assert.isTrue(cond)`                         |

Each harness wraps every case, catches failures, and reports through a **result protocol**: stdout lines of the form `\u001eCCP:{"id":"…","status":"pass|fail|error","message":"…"}`. JS-based runtimes post the same objects over `postMessage`. `normalizeTestResults()` turns protocol lines plus the process outcome into `TestResult[]`, marking cases that never reported as `not-run` (e.g. after a crash or timeout).

Hidden cases are omitted from the run the user triggers with "Run tests" and included on "Submit".

## Alternatives Considered

- **I/O pairs with language-specific serialisers.** Uniform, but can't express behavioural tests and pushes complex serialisation onto C/Java.
- **Full native frameworks** (pytest, JUnit, GoogleTest). Unavailable or too heavy in the browser runtimes.

## Consequences

- LLMs write short, idiomatic test snippets well, which improves generation quality.
- Protocol parsing is one tested module. User stdout that happens to mimic the prefix is rejected because the harness includes a per-run nonce in the prefix.
