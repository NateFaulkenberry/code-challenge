import { loadAgentSdk, type AgentSdk } from "./agent-sdk.ts";
import type { ClaudeConfig } from "./config.ts";
import { DisabledClaudeProvider } from "./disabled-provider.ts";
import { SubscriptionClaudeProvider } from "./subscription-provider.ts";
import type { ClaudeProvider } from "./types.ts";

export interface ClaudeServiceDeps {
  env: Record<string, string | undefined>;
  loadSdk?: () => Promise<AgentSdk>;
  log?: (line: string) => void;
}

/** Selects the provider for this configuration. Anything not explicitly "subscription" is disabled. */
export function createClaudeProvider(
  config: ClaudeConfig,
  deps: ClaudeServiceDeps,
): ClaudeProvider {
  if (config.provider === "subscription") {
    return new SubscriptionClaudeProvider({
      config,
      env: deps.env,
      loadSdk: deps.loadSdk ?? loadAgentSdk,
      ...(deps.log ? { log: deps.log } : {}),
    });
  }
  return new DisabledClaudeProvider(config);
}
