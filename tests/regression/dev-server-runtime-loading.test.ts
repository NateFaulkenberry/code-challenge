/**
 * Two bugs that only appeared on the Vite dev server (and therefore in
 * `docker compose up`), never in the production build the E2E suite uses:
 *
 * 1. PHP: excluding @php-wasm/universal from dependency pre-bundling left its
 *    CommonJS dependency `ini` unconverted, so the worker failed to import
 *    (`ini.js does not provide an export named 'parse'`). Only the package
 *    with raw `.wasm` imports (@php-wasm/web-8-4) may be excluded.
 * 2. C/C++: the dev server rewrites root-relative dynamic imports with
 *    `?import` and refuses to serve public/ files as modules (HTTP 500).
 *    The clang bundle must be imported by absolute URL.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../../vite.config";

describe("regression: runtimes load on the dev server", () => {
  it("pre-bundles php-wasm's universal package (only the wasm build is excluded)", () => {
    const excluded =
      (config as { optimizeDeps?: { exclude?: string[] } }).optimizeDeps?.exclude ?? [];
    expect(excluded).toContain("@php-wasm/web-8-4");
    expect(excluded).not.toContain("@php-wasm/universal");
  });

  it("imports the self-hosted clang bundle by absolute URL", () => {
    const source = readFileSync(
      new URL("../../src/runtimes/clang/toolchain.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(
      /new URL\(\s*assetUrl\(`runtimes\/clang\/[^`]*`\),\s*self\.location\.href,?\s*\)\s*\.href/,
    );
  });
});
