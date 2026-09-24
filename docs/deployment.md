# Deployment

The production site is fully static and deployed to GitHub Pages ([ADR-008](adr/008-github-pages-deployment.md)).

## Pipeline

```text
push to main
   └─ CI workflow (.github/workflows/ci.yml)
        verify: format → typecheck → lint → unit/integration/runtime tests → dependency audit
        build:  production build with the Pages base path + bundle-size summary
        e2e:    Playwright against the production build
   └─ Deploy workflow (.github/workflows/deploy.yml), triggered by CI completing
        only if CI concluded "success" → checkout the verified SHA → build →
        verify output (index.html, sandbox.html, sandbox CSP) → upload-pages-artifact → deploy-pages
```

A failing test anywhere in CI prevents deployment.

## One-time repository setup

1. **Pages source:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. **Push to `main`:** that's all. `actions/configure-pages` supplies the base path (`/<repo>/`, or `/` on a custom domain), and the build reads it from `BASE_PATH`.

## Base paths

- **Routing:** hash routing (`/#/challenges/…`) means deep links need no server rewrites.
- **Asset URLs:** URLs used at runtime (sandbox page, Pyodide, clang, published portfolio) go through `assetUrl()`, which is based on `import.meta.env.BASE_URL`. Nothing assumes `/`.
- **Tests:** E2E runs the build under `/code-challenge/` to catch base-path bugs, and `tests/regression/github-pages-base-path.test.ts` checks the helpers.

## Size

The deployed site is about 200 MB, almost entirely language toolchains (clang ~109 MB, php-wasm ~40 MB for two variants, Pyodide ~15 MB), within Pages' 1 GB limit. Visitors download only the app shell (~161 KB gzipped) until they use a language.

## Custom domain

Add the domain in Settings → Pages. `configure-pages` then reports an empty base path and the build targets `/`.
