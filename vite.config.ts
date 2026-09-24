/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * php-wasm's loader modules `import url from "./php_8_4.wasm"`, expecting a
 * bundler to turn the binary into an asset URL. Vite reserves bare `.wasm`
 * imports for WebAssembly ESM integration, so rewrite them to `?url`.
 */
export function phpWasmAssets(): Plugin {
  return {
    name: "ccl-php-wasm-assets",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@php-wasm/web-")) return null;
      const rewritten = code.replace(/(from\s+["'][^"']+\.wasm)(["'])/g, "$1?url$2");
      return rewritten === code ? null : { code: rewritten, map: null };
    },
  };
}

/**
 * GitHub Pages project sites live under `/<repo>/`. CI passes the base path from
 * `actions/configure-pages`; locally the app is served from `/`.
 */
export function normalizeBase(raw: string | undefined): string {
  if (!raw || raw === "/") return "/";
  const trimmed = raw.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

const src = fileURLToPath(new URL("./src", import.meta.url));

/** Versions of self-hosted toolchains, used to build their asset paths. */
function packageVersion(name: string): string {
  const path = fileURLToPath(new URL(`./node_modules/${name}/package.json`, import.meta.url));
  return (JSON.parse(readFileSync(path, "utf8")) as { version: string }).version;
}

export default defineConfig({
  base: normalizeBase(process.env.BASE_PATH),
  plugins: [react(), phpWasmAssets()],
  resolve: { alias: { "@": src } },
  define: { __CLANG_VERSION__: JSON.stringify(packageVersion("@yowasp/clang")) },
  worker: {
    format: "es",
    plugins: () => [phpWasmAssets()],
    rollupOptions: {
      onLog(level, log, handler) {
        if (log.code === "EVAL" && log.id?.includes("@php-wasm/")) return;
        handler(level, log);
      },
    },
  },
  // Toolchains load their own wasm at runtime; pre-bundling would break asset URLs.
  optimizeDeps: { exclude: ["pyodide", "@php-wasm/web-8-4"] },
  server: {
    // The React sandbox iframe has an opaque ("null") origin, so its module
    // requests are cross-origin. GitHub Pages answers them with
    // `Access-Control-Allow-Origin: *`; mirror that locally.
    cors: true,
  },
  preview: { cors: true },
  build: {
    target: "es2023",
    // Language toolchain workers are large by nature and lazy-loaded; the
    // app shell budget (~250 KB gz) is tracked in CI's bundle report instead.
    chunkSizeWarningLimit: 1_500,
    rollupOptions: {
      input: { main: fileURLToPath(new URL("./index.html", import.meta.url)) },
      onLog(level, log, handler) {
        // php-wasm's Emscripten glue uses eval by design; nothing to act on here.
        if (log.code === "EVAL" && log.id?.includes("@php-wasm/")) return;
        handler(level, log);
      },
    },
    // sandbox.html is built separately (vite.sandbox.config.ts) with React's
    // development build; in dev, this server serves it directly.
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          testTimeout: 20_000,
          include: ["src/**/*.test.ts", "tests/{integration,regression,runtime}/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          testTimeout: 20_000,
          include: ["src/**/*.test.tsx", "tests/{integration,regression,runtime}/**/*.test.tsx"],
          setupFiles: ["./tests/setup-dom.ts"],
        },
      },
    ],
  },
});
