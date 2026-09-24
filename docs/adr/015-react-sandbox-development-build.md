# ADR-015: React Sandbox Uses a Separate Development-React Build

## Status

Accepted — 2026-09-23

## Context

React challenges are tested with Testing Library inside the sandboxed iframe. The first production build failed every React test with `act is not a function`: **React 19's production build doesn't export `act()`**, and Testing Library requires it. Development mode masked the problem, because the dev server serves development React.

## Decision

Build `sandbox.html` separately (`vite.sandbox.config.ts`) with `mode: "development"` and `process.env.NODE_ENV = "development"`, minified, and emitted into `dist/assets/sandbox/`. The main app remains a normal production build. `npm run build` runs both builds.

## Alternatives Considered

- **Drop Testing Library and write a custom harness on `createRoot`.** Loses the API LLMs generate most reliably, plus realistic user-event interactions.
- **Alias only React to its development build inside the main build.** Rollup shares chunks between entries, so the alias would leak into the app shell or require fragile manual chunking.

## Consequences

- The sandbox bundle is about 270 KB gzipped instead of about 90 KB. It's only fetched for React challenges.
- Users get development-mode warnings and component stacks for their own components, which is useful in a practice tool.
- `tests/e2e/react.spec.ts` runs against the production build, so a regression here is caught.
