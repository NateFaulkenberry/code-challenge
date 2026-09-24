import { describe, expect, it } from "vitest";
import { scanText } from "./check-bundle.ts";

const rulesHit = (text: string) => scanText("bundle.js", text).map((f) => f.rule);

describe("production bundle scanner", () => {
  it.each([
    ["an API key", 'const k="sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWx"', "anthropic-credential"],
    ["an OAuth token", "token: sk-ant-oat01-AbCdEfGhIjKlMnOpQrStUvWxYz", "anthropic-credential"],
    ["a baked-in env var", 'ANTHROPIC_API_KEY="abcdefghijklmnopqrst"', "credential-assignment"],
    [
      "a baked-in OAuth env var",
      "CLAUDE_CODE_OAUTH_TOKEN=abcdefghijklmnopqrstuv",
      "credential-assignment",
    ],
    [
      "serialized auth state",
      '{"refresh_token":"abcdefghijklmnopqrstuvwx"}',
      "serialized-oauth-token",
    ],
    ["the Claude credential store", '{"claudeAiOauth":{}}', "claude-credentials-store"],
    ["a local-only endpoint", 'fetch("/__local/claude/generate")', "local-claude-endpoint"],
    ["Agent SDK code", 'import("@anthropic-ai/claude-agent-sdk")', "agent-sdk-code"],
    ["a developer's home path", '"/Users/nate/.claude/settings.json"', "developer-home-path"],
  ])("flags %s", (_label, text, rule) => {
    expect(rulesHit(text)).toContain(rule);
  });

  it.each([
    ["the settings placeholder", 'placeholder:"sk-ant-…"'],
    ["the API key header name", 'headers:{"x-api-key":e}'],
    ["documentation mentioning variables", "Set ANTHROPIC_API_KEY in your shell to use the API."],
    [
      "generic OAuth wording",
      "OAuth login is handled by Claude Code; access_token is never stored here",
    ],
    ["a masked key", "Stored key: sk-ant-…ijkl"],
  ])("does not flag %s", (_label, text) => {
    expect(rulesHit(text)).toEqual([]);
  });

  it("masks excerpts so CI logs never repeat a secret", () => {
    const [finding] = scanText("x.js", "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWx");
    expect(finding?.excerpt).toMatch(/^sk-ant-a…\(\d+ chars\)$/);
    expect(finding?.excerpt).not.toContain("AbCdEf");
  });
});
