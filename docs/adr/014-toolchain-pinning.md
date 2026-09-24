# ADR-014: Toolchain Version Pinning (TypeScript 6.0)

## Status

Accepted — 2026-09-23

## Context

`typescript@latest` is 7.0, the Go-native compiler. It exposes no stable JS API, and `typescript-eslint` supports only `typescript <6.1`.

## Decision

Pin `typescript` to `~6.0.3` for type checking and linting. User code is transpiled at runtime by sucrase, so the app doesn't depend on the compiler at runtime. Revisit when `typescript-eslint` supports 7.x.

## Alternatives Considered

- **TypeScript 7 for `tsc --noEmit` with 6.0 for ESLint**: two compilers means two sets of diagnostics.

## Consequences

- The project won't get TS 7's faster type checks yet.
