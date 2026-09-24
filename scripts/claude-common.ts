/** Shared helpers for the claude:* developer scripts (Node, local only). */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readClaudeConfig } from "../server/claude/config.ts";
import { loadAgentSdk } from "../server/claude/agent-sdk.ts";
import { SubscriptionClaudeProvider } from "../server/claude/subscription-provider.ts";
import { presentApiBillingVariables } from "../server/claude/safe-env.ts";

/** Always probes the subscription path, whatever CLAUDE_PROVIDER says (the scripts are explicit developer actions). */
export function subscriptionProvider(log?: (line: string) => void): SubscriptionClaudeProvider {
  return new SubscriptionClaudeProvider({
    config: { ...readClaudeConfig(process.env), provider: "subscription" },
    env: process.env,
    loadSdk: loadAgentSdk,
    ...(log ? { log } : {}),
  });
}

/** The Claude Code binary bundled with @anthropic-ai/claude-agent-sdk (npm optional dependency). */
export function bundledClaudeBinary(): string | undefined {
  const require = createRequire(import.meta.url);
  const suffixes = process.platform === "linux" ? ["", "-musl"] : [""];
  for (const suffix of suffixes) {
    try {
      const pkg = require.resolve(
        `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}${suffix}/package.json`,
      );
      const binary = join(dirname(pkg), process.platform === "win32" ? "claude.exe" : "claude");
      if (existsSync(binary)) return binary;
    } catch {
      // try the next variant
    }
  }
  return undefined;
}

export function printHeader(title: string): void {
  console.log(`\n${title}\n${"-".repeat(title.length)}`);
}

export function describeEnvironment(): void {
  const config = readClaudeConfig(process.env);
  const ignored = presentApiBillingVariables(process.env);
  console.log(
    `Dev server setting: CLAUDE_PROVIDER=${process.env.CLAUDE_PROVIDER ?? "(unset)"} → ${config.provider === "subscription" ? "enabled" : "disabled"}`,
  );
  if (config.problems.length) console.log(`Configuration:      ${config.problems.join(" ")}`);
  console.log(
    `Long-lived token:   ${(process.env.CLAUDE_CODE_OAUTH_TOKEN ?? "") !== "" ? "CLAUDE_CODE_OAUTH_TOKEN is set (value hidden)" : "not set (using Claude Code's saved login)"}`,
  );
  if (ignored.length)
    console.log(
      `Ignored variables:  ${ignored.join(", ")} (never used by this integration — no API billing)`,
    );
}
