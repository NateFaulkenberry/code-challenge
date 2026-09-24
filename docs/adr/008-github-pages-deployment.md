# ADR-008: GitHub Pages Deployment

## Status

Accepted — 2026-09-23

## Context

The site must work at `https://user.github.io/repo/` and at a custom domain root. Pages cannot rewrite URLs or set headers.

## Decision

- **Hash routing** (`createHashRouter`): deep links work without server rewrites and return HTTP 200.
- **Base path** from the `BASE_PATH` env var, fed to Vite's `base`. CI sets it from `actions/configure-pages`' `base_path` output. Runtime URLs (Pyodide, sandbox page, portfolio JSON) are built with a `assetUrl()` helper based on `import.meta.env.BASE_URL`. A regression test builds with a non-root base.
- **Workflow:** install → format check → typecheck → lint → unit/integration → build → E2E against `vite preview` with the same base → `upload-pages-artifact@v5` → `deploy-pages@v5`. Deploy runs only on `main` and only if every prior job passed.

## Alternatives Considered

- **`404.html` SPA redirect**: deep links would be served with HTTP 404, which is fragile.
- **A relative `base: "./"`**: breaks worker and sandbox URLs resolved from nested routes in some browsers. An explicit base is clearer.

## Consequences

- URLs contain `#/`, a cosmetic cost accepted for robustness.
- Large runtime assets (e.g. clang's ~75 MB wasm) are deployed as static files. Pages' 1 GB site limit accommodates them.
