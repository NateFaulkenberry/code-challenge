# ADR-013: Portfolio Publishing and Import/Export Format

## Status

Accepted — 2026-09-23

## Context

The most important audience, prospective employers, visit the Pages site with an empty browser database. They must see completed work without configuring anything. The owner also needs backups.

## Decision

One versioned, Zod-validated file format:

```json
{ "format": "coding-challenge-portfolio", "version": 1, "exportedAt": "…",
  "kind": "backup" | "portfolio", "attempts": [ … ], "settings": { … }? }
```

- **Backup export**: all attempts plus non-secret settings.
- **Portfolio export**: only `passed` attempts, containing the challenge, the passing solution, results and the owner's approach notes. No unfinished work, no settings.
- **Publishing**: the owner commits a portfolio export to `public/portfolio/portfolio.json`. The site fetches it at runtime and shows it as read-only published work, merged with any local history.
- **Import**: validation, version migration (older versions are upgraded, newer versions are rejected with a clear message), and duplicate handling (skip, overwrite, or keep the newer `updatedAt`), with a preview summary before committing.

## Alternatives Considered

- **Per-challenge folders** (`portfolio/challenges/<slug>/solution.ts`). Friendlier on GitHub, but it requires either a zip library or a CLI. The format is designed so a small script can expand the JSON into that layout later.

## Consequences

- Publishing is a deliberate git commit, so the owner controls exactly what's public.
- Visitors get a fast, zero-config portfolio.
