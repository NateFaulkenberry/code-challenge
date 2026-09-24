/**
 * Environment hygiene for the subscription provider.
 *
 * Claude Code picks credentials in a fixed precedence order in which
 * ANTHROPIC_API_KEY (and cloud-provider / gateway variables) outrank the
 * claude.ai subscription login. If any of them leaked into the child process,
 * requests would silently switch to API billing. They are removed here, and
 * the provider additionally verifies at runtime that no API key is in use.
 */
export const API_BILLING_VARIABLES = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_PROFILE",
  "ANTHROPIC_FEDERATION_RULE_ID",
  "ANTHROPIC_ORGANIZATION_ID",
  "ANTHROPIC_IDENTITY_TOKEN_FILE",
  "AWS_BEARER_TOKEN_BEDROCK",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "CLAUDE_CODE_USE_ANTHROPIC_AWS",
] as const;

/** Variables whose values are secrets and must never appear in logs or responses. */
export const SECRET_VARIABLES = [
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "AWS_BEARER_TOKEN_BEDROCK",
] as const;

export const CLIENT_APP_ID = "coding-challenge-lab-local/1";

/** A copy of `env` safe to hand to the Claude Code subprocess for subscription auth. */
export function subscriptionEnv(env: Record<string, string | undefined>): Record<string, string> {
  const blocked = new Set<string>(API_BILLING_VARIABLES);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === "" || blocked.has(key)) continue;
    result[key] = value;
  }
  result.CLAUDE_AGENT_SDK_CLIENT_APP = CLIENT_APP_ID;
  return result;
}

/** Names of API-billing variables present in `env` (names only, never values). */
export function presentApiBillingVariables(env: Record<string, string | undefined>): string[] {
  return API_BILLING_VARIABLES.filter((name) => (env[name] ?? "") !== "");
}

const TOKEN_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  /\b(?:Bearer|x-api-key:?)\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
];

/** Removes secret values (from `env`) and token-shaped strings from text. */
export function redactSecrets(text: string, env: Record<string, string | undefined> = {}): string {
  let result = text;
  for (const name of SECRET_VARIABLES) {
    const value = env[name];
    if (value && value.length >= 8) result = result.split(value).join("[redacted]");
  }
  for (const pattern of TOKEN_PATTERNS) result = result.replace(pattern, "[redacted]");
  return result;
}
