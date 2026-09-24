# ADR-005: Persistence Strategy

## Status

Accepted — 2026-09-23

## Context

Challenge definitions, solutions and results must survive reloads without a server. Source code and challenge JSON can reach tens of kilobytes per attempt, and history can grow to hundreds of attempts.

## Decision

- **IndexedDB via `idb`** (≈1 KB) behind a `ChallengeRepository` interface. There is one `attempts` store keyed by challenge id, with indexes on `status`, `language` and `updatedAt`.
- Every record is validated with Zod on read. Invalid records are quarantined and reported, never crash the app.
- A `schemaVersion` on each record plus explicit migrations run on open.
- **`localStorage`** only for preferences (`SettingsStore`). The API key is in a separate key so it can never be exported by accident.
- Stored execution results are summaries (status per test plus output truncated to 8 KB), not full logs.
- An **in-memory repository** implementation is used in unit and integration tests.

## Alternatives Considered

- **Dexie**: good migrations and live queries, but ~25 KB and more API than a single store needs.
- **localStorage only**: synchronous, about 5 MB quota, string-only. Unsuitable for history.
- **OPFS**: great for files, but awkward for indexed queries and adds nothing here.

## Consequences

- Data is per-browser and per-origin. Import/export ([ADR-013](013-portfolio-publishing.md)) is the backup and portability story.
- Private browsing modes may refuse IndexedDB. This surfaces as a "Storage unavailable" state, and the app falls back to in-memory storage for the session.
