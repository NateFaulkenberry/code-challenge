import type { Plugin } from "vite";
import { readClaudeConfig } from "./config.ts";
import { createLocalClaudeHandler } from "./http.ts";
import { createClaudeProvider } from "./service.ts";

/**
 * Mounts the local Claude endpoints on the Vite *dev* server only
 * (`apply: "serve"`). `vite build` never runs this plugin, so the static
 * GitHub Pages site has no Claude endpoints, code or configuration.
 */
export function localClaudePlugin(env: Record<string, string | undefined> = process.env): Plugin {
  return {
    name: "ccl-local-claude",
    apply: "serve",
    configureServer(server) {
      if (env.VITEST) return;
      const config = readClaudeConfig(env);
      const log = (line: string) => server.config.logger.info(`[local-claude] ${line}`);
      const provider = createClaudeProvider(config, { env, log });
      server.middlewares.use(createLocalClaudeHandler(provider, { env, log }));
      server.config.logger.info(
        config.provider === "subscription"
          ? "[local-claude] enabled: Claude Agent SDK with your Claude subscription (local only)"
          : `[local-claude] disabled${config.problems.length ? ` — ${config.problems.join(" ")}` : " (use `npm run dev:claude` to enable)"}`,
      );
    },
  };
}
