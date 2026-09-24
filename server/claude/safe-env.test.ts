import { describe, expect, it } from "vitest";
import {
  API_BILLING_VARIABLES,
  CLIENT_APP_ID,
  presentApiBillingVariables,
  redactSecrets,
  subscriptionEnv,
} from "./safe-env.ts";

describe("subscriptionEnv", () => {
  const env = {
    PATH: "/usr/bin",
    HOME: "/home/dev",
    ANTHROPIC_API_KEY: "sk-ant-api03-secretsecretsecret",
    ANTHROPIC_AUTH_TOKEN: "bearer-secret",
    ANTHROPIC_BASE_URL: "https://evil.example",
    CLAUDE_CODE_USE_BEDROCK: "1",
    CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-subscriptiontoken",
    EMPTY: "",
  };

  it("removes every variable that would switch Claude Code to API or third-party billing", () => {
    const result = subscriptionEnv(env);
    for (const name of API_BILLING_VARIABLES) expect(result).not.toHaveProperty(name);
  });

  it("keeps the subscription token and ordinary variables, drops empties, tags the client", () => {
    expect(subscriptionEnv(env)).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/dev",
      CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-subscriptiontoken",
      CLAUDE_AGENT_SDK_CLIENT_APP: CLIENT_APP_ID,
    });
  });

  it("does not mutate its input", () => {
    const copy = { ...env };
    subscriptionEnv(env);
    expect(env).toEqual(copy);
  });

  it("names (never shows) API-billing variables that are present", () => {
    expect(presentApiBillingVariables(env)).toEqual([
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_BASE_URL",
      "CLAUDE_CODE_USE_BEDROCK",
    ]);
  });
});

describe("redactSecrets", () => {
  it("removes secret env values and token-shaped strings", () => {
    const env = { CLAUDE_CODE_OAUTH_TOKEN: "my-long-oauth-token-value" };
    const text =
      "failed with my-long-oauth-token-value and sk-ant-api03-abcdefghijkl, header Bearer abcdefghijklmnop";
    const redacted = redactSecrets(text, env);
    expect(redacted).not.toContain("my-long-oauth-token-value");
    expect(redacted).not.toContain("sk-ant-api03");
    expect(redacted).not.toContain("abcdefghijklmnop");
    expect(redacted).toContain("[redacted]");
  });

  it("leaves ordinary text alone", () => {
    expect(redactSecrets("Not logged in · Please run /login")).toBe(
      "Not logged in · Please run /login",
    );
  });
});
