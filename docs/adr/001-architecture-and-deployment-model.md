# ADR-001: Architecture and Deployment Model

## Status

Accepted — 2026-09-23

## Context

The application is a portfolio artifact that must be publicly reachable at no cost, stay online without maintenance, and never expose secrets. Its core activities — editing, compiling, running and testing code — are compute-bound and personal, so they don't need shared server state.

## Decision

Build a **static single-page application** (Vite + React + TypeScript) deployed to **GitHub Pages**. All execution, validation and persistence happen client-side. External network access is limited to optional LLM calls that the user makes with their own key.

The codebase is layered: domain (pure, schema-first) → services (generation, execution) → persistence → features/UI. React components depend on hooks and services, never on runtime or storage internals.

## Alternatives Considered

- **Server-rendered app with a container-based code runner** (e.g. Judge0 style). Stronger isolation and every language supported fully, but it needs hosting, abuse protection, cost management and secrets. Rejected for v1; the runtime abstraction leaves room for a remote provider later ([ADR-003](003-language-runtime-architecture.md)).
- **Next.js static export.** Adds framework surface area (server components, file routing) that brings nothing to a purely client-side app.

## Consequences

- Zero hosting cost and no operational burden; the site works offline once assets are cached.
- Browser limitations define what's possible per language, and those limits are documented instead of hidden ([runtimes.md](../runtimes.md)).
- Hidden tests and reference solutions ship to the client. They cannot be secret ([ADR-006](006-code-execution-security-model.md)).
- Visitors don't share the owner's IndexedDB, so portfolio content must be published as static files ([ADR-013](013-portfolio-publishing.md)).
