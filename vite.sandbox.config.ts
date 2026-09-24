import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { normalizeBase } from "./vite.config.ts";

/**
 * The React sandbox must never reach the network, open frames or submit forms.
 * A CSP <meta> can't be relaxed by code inside the page (unlike deleting
 * globals). Applied to production builds only, because the dev server needs a
 * websocket for HMR.
 */
export const SANDBOX_CSP =
  "connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'";

function sandboxCsp(): Plugin {
  return {
    name: "ccl-sandbox-csp",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        if (!context.filename.endsWith("sandbox.html")) return html;
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}" />`,
        );
      },
    },
  };
}

/**
 * Separate build for the React sandbox iframe. It uses React's *development*
 * build on purpose: `act()` (required by Testing Library) does not exist in
 * React's production build, and development React gives users component
 * stacks and warnings for their own components. The cost only applies to
 * React challenges, which are the only thing that loads sandbox.html.
 */
export default defineConfig({
  mode: "development",
  base: normalizeBase(process.env.BASE_PATH),
  plugins: [react(), sandboxCsp()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  build: {
    target: "es2023",
    outDir: "dist",
    emptyOutDir: false,
    minify: true,
    chunkSizeWarningLimit: 1_200,
    rollupOptions: {
      input: { sandbox: fileURLToPath(new URL("./sandbox.html", import.meta.url)) },
      output: {
        entryFileNames: "assets/sandbox/[name]-[hash].js",
        chunkFileNames: "assets/sandbox/[name]-[hash].js",
        assetFileNames: "assets/sandbox/[name]-[hash][extname]",
      },
    },
  },
});
