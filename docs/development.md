# Development

## Prerequisites

- **Node:** 22.14+ or 24 LTS (the Docker image and CI use Node 24).
- **Disk:** about 700 MB for `node_modules`, most of it the language toolchains (clang ~105 MB, php-wasm builds, Pyodide).

## Commands

| Command                                 | Purpose                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                           | Dev server at http://localhost:5173 (copies runtime assets first)                 |
| `npm test` / `npm run test:watch`       | Vitest                                                                            |
| `npm run test:e2e`                      | Playwright (builds with `BASE_PATH=/code-challenge/`, serves with `vite preview`) |
| `npm run build`                         | Production build: the app, plus the separate React sandbox build                  |
| `npm run typecheck` · `lint` · `format` | TypeScript 6.0, typescript-eslint (strict, type-checked), Prettier                |

## Docker

```bash
docker compose up                     # dev server (source bind-mounted, node_modules in a volume)
docker compose run --rm app test      # any npm script: test, build, lint, typecheck…
docker compose run --rm e2e           # Playwright in mcr.microsoft.com/playwright
```

## Project layout

```text
src/
  app/            entry point, router (hash), layout, context providers, services wiring
  components/     design-system primitives (Button, Dialog, Tabs, Notice, Markdown…)
  domain/         Zod schemas + pure logic (languages, attempts, library, stats, export format)
  editor/         CodeMirror 6 wrapper, lazy language modes, theme from CSS variables
  features/       dashboard, workspace, library/portfolio, generation dialog, settings/data
  persistence/    ChallengeRepository (IndexedDB via idb, in-memory), settings/secret stores
  runtimes/       core (SandboxRuntime, protocol, endpoints), js, typescript, react, python, php, clang
  sandbox/        entry point of the React iframe (built by vite.sandbox.config.ts)
  services/       execution service, generation pipeline, attempt store, published portfolio
prompts/          versioned LLM prompts and per-language harness docs
fixtures/         deterministic sample challenges
tests/            e2e, runtime contract, regression, helpers
scripts/          copy-runtime-assets.mjs
```

## Conventions

- **Domain logic** lives in `src/domain` and `src/services`. Components call hooks, never storage or runtimes directly.
- **Language values:** anything keyed by language is a `Record<LanguageId, …>`, so adding a language is compiler-guided.
- **Errors are states.** User-facing messages are plain language, with technical details in a collapsed section.
- **Every fixed bug gets a regression test** in `tests/regression/`.
- **Architectural decisions get an ADR** in `docs/adr/`.

## Publishing portfolio entries

Complete challenges locally. Then go to **Settings → Data → Export portfolio** and commit the file as `public/portfolio/portfolio.json`. Visitors see those entries as read-only published work.
