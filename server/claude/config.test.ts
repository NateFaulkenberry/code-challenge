import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEOUT_MS, readClaudeConfig } from "./config.ts";

describe("readClaudeConfig", () => {
  it("is disabled by default", () => {
    expect(readClaudeConfig({})).toEqual({
      provider: "disabled",
      timeoutMs: DEFAULT_TIMEOUT_MS,
      debug: false,
      problems: [],
    });
  });

  it("enables only the explicit subscription provider", () => {
    expect(readClaudeConfig({ CLAUDE_PROVIDER: " Subscription " }).provider).toBe("subscription");
    expect(readClaudeConfig({ CLAUDE_PROVIDER: "disabled" }).provider).toBe("disabled");
  });

  it("never turns 'api' into an API-key provider", () => {
    const config = readClaudeConfig({
      CLAUDE_PROVIDER: "api",
      ANTHROPIC_API_KEY: "sk-ant-api03-xxxxxxxxxxxx",
    });
    expect(config.provider).toBe("disabled");
    expect(config.problems[0]).toContain("only uses your Claude subscription");
  });

  it("reports malformed values instead of throwing", () => {
    const config = readClaudeConfig({
      CLAUDE_PROVIDER: "local!!",
      CLAUDE_MODEL: "opus; rm -rf /",
      CLAUDE_TIMEOUT_MS: "12",
    });
    expect(config.provider).toBe("disabled");
    expect(config.model).toBeUndefined();
    expect(config.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(config.problems).toHaveLength(3);
  });

  it("accepts a model and timeout", () => {
    expect(
      readClaudeConfig({
        CLAUDE_PROVIDER: "subscription",
        CLAUDE_MODEL: "claude-sonnet-5",
        CLAUDE_TIMEOUT_MS: "60000",
      }),
    ).toMatchObject({
      model: "claude-sonnet-5",
      timeoutMs: 60_000,
      problems: [],
    });
  });
});
