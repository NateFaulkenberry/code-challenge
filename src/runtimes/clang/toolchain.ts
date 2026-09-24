import { assetUrl } from "@/utils/asset-url";
import type { ClangToolchain } from "./handler";

/** Loads the self-hosted clang bundle; it fetches its own ~100 MB of wasm/resources relative to itself. */
export function loadSelfHostedToolchain(): Promise<ClangToolchain> {
  // Absolute URL on purpose: Vite's dev server rewrites root-relative dynamic
  // imports (adding `?import`) and refuses to serve files from public/ as
  // modules. An absolute URL is fetched as a plain static file in dev and prod.
  const url = new URL(assetUrl(`runtimes/clang/${__CLANG_VERSION__}/bundle.js`), self.location.href)
    .href;
  return import(/* @vite-ignore */ url) as Promise<ClangToolchain>;
}
