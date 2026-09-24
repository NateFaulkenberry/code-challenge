import type { ClaudeProviderKind } from "./types.ts";

export interface ClaudeConfig {
  provider: ClaudeProviderKind;
  model?: string;
  timeoutMs: number;
  /** Configuration mistakes, reported through status instead of crashing the dev server. */
  problems: string[];
}

export const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Reads the local Claude configuration from the environment.
 *
 *   CLAUDE_PROVIDER    disabled (default) | subscription
 *   CLAUDE_MODEL       optional model id/alias for Claude Code (default: its own default)
 *   CLAUDE_TIMEOUT_MS  optional request timeout, 5000–600000
 *
 * Safe by default: anything unrecognised resolves to "disabled". There is
 * deliberately no API-key provider here — API keys are handled by the app's
 * explicit in-browser BYOK provider, never as a silent fallback.
 */
export function readClaudeConfig(env: Record<string, string | undefined>): ClaudeConfig {
  const problems: string[] = [];
  const rawProvider = (env.CLAUDE_PROVIDER ?? "").trim().toLowerCase();
  let provider: ClaudeProviderKind = "disabled";
  if (rawProvider === "subscription") {
    provider = "subscription";
  } else if (rawProvider === "api") {
    problems.push(
      'CLAUDE_PROVIDER=api is not supported by the local integration, which only uses your Claude subscription. For API-key billing, pick "Anthropic — your own API key" in the app\'s Settings.',
    );
  } else if (rawProvider !== "" && rawProvider !== "disabled") {
    problems.push(
      `CLAUDE_PROVIDER="${rawProvider}" is not recognised; expected "subscription" or "disabled".`,
    );
  }

  const rawModel = env.CLAUDE_MODEL?.trim();
  let model: string | undefined;
  if (rawModel) {
    if (/^[A-Za-z0-9._[\]-]{1,100}$/.test(rawModel)) model = rawModel;
    else problems.push("CLAUDE_MODEL contains unexpected characters and was ignored.");
  }

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  const rawTimeout = env.CLAUDE_TIMEOUT_MS?.trim();
  if (rawTimeout) {
    const parsed = Number(rawTimeout);
    if (Number.isInteger(parsed) && parsed >= 5_000 && parsed <= 600_000) timeoutMs = parsed;
    else
      problems.push(
        "CLAUDE_TIMEOUT_MS must be an integer between 5000 and 600000; using the default.",
      );
  }

  return { provider, ...(model ? { model } : {}), timeoutMs, problems };
}
