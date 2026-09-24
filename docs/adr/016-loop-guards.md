# ADR-016: Loop Guards for JavaScript Execution

## Status

Accepted — 2026-09-23

## Context

A wall-clock timeout that terminates the Worker is enough to stop runaway TypeScript. The React sandbox is different: a sandboxed iframe **may run on the page's main thread** (browsers don't all isolate sandboxed iframes in a separate process). A `while (true)` in a component would then freeze the whole app, and the host's timeout timer could never fire.

Separately, one runaway test in a Worker shouldn't cost the results of every other test in the run.

## Decision

After sucrase transpiles user code (solutions and tests), parse it with **acorn** and rewrite every loop:

```js
{ let __ccl_l1 = __ccl_loopStart(); while (c) { __ccl_loopCheck(__ccl_l1); … } }
```

The check samples the clock every 1,024 iterations and throws `LoopBudgetError` once a single loop entry exceeds its budget: **1 s** in the iframe, **5 s** in Workers. Labelled loops are wrapped outside their label so `continue label` keeps working. Parsing with acorn also turns syntax that sucrase lets through into proper compile errors with line numbers.

## Alternatives Considered

- **Regex-based loop protection** (as in some online editors). Breaks on strings, comments, template literals and single-statement bodies.
- **Babel.** Heavier (several hundred KB) for one transform.
- **Rely on browser process isolation for iframes.** It isn't universal.

## Consequences

- Adds acorn (~30 KB gzipped) to the TypeScript worker and the React sandbox.
- Loops that legitimately run longer than the budget are stopped. This is documented in the runtime constraints.
- Non-loop runaway code (deep synchronous recursion) is still stopped by the engine's stack limit, and Worker code by termination.
