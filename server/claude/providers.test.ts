import { describe, expect, it } from "vitest";
import { readClaudeConfig } from "./config.ts";
import { DisabledClaudeProvider } from "./disabled-provider.ts";
import {
  fakeSdk,
  initMessage,
  READY_ACCOUNT,
  successResult,
  type FakeScript,
} from "./fake-sdk.test-helper.ts";
import { createClaudeProvider } from "./service.ts";
import {
  flattenConversation,
  judgeAccount,
  SubscriptionClaudeProvider,
} from "./subscription-provider.ts";
import { ClaudeError } from "./types.ts";

const request = {
  system: "You write JSON.",
  messages: [{ role: "user" as const, content: "Say hi" }],
};
const SECRET = "sk-ant-oat01-THIS-IS-A-FAKE-SUBSCRIPTION-TOKEN";

function setup(
  script: FakeScript,
  overrides: { env?: Record<string, string>; timeoutMs?: number; statusTimeoutMs?: number } = {},
) {
  const sdk = fakeSdk(script);
  const logs: string[] = [];
  const env = { PATH: "/usr/bin", ...overrides.env };
  const provider = new SubscriptionClaudeProvider({
    config: {
      ...readClaudeConfig({ CLAUDE_PROVIDER: "subscription" }),
      ...(overrides.timeoutMs ? { timeoutMs: overrides.timeoutMs } : {}),
    },
    env,
    loadSdk: () => Promise.resolve(sdk),
    log: (line) => logs.push(line),
    workDir: () => "/tmp/ccl-test",
    ...(overrides.statusTimeoutMs ? { statusTimeoutMs: overrides.statusTimeoutMs } : {}),
  });
  return { sdk, provider, logs };
}

async function expectClaudeError(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ClaudeError);
  expect((error as ClaudeError).code).toBe(code);
  return error as ClaudeError;
}

describe("provider selection", () => {
  it("uses the disabled provider unless subscription is explicitly configured", () => {
    expect(createClaudeProvider(readClaudeConfig({}), { env: {} }).kind).toBe("disabled");
    expect(
      createClaudeProvider(readClaudeConfig({ CLAUDE_PROVIDER: "api" }), { env: {} }).kind,
    ).toBe("disabled");
    expect(
      createClaudeProvider(readClaudeConfig({ CLAUDE_PROVIDER: "subscription" }), { env: {} }).kind,
    ).toBe("subscription");
  });

  it("never loads the SDK for the disabled provider", async () => {
    let loaded = false;
    const provider = createClaudeProvider(readClaudeConfig({}), {
      env: {},
      loadSdk: () => ((loaded = true), Promise.reject(new Error("no"))),
    });
    expect(await provider.status()).toMatchObject({ state: "disabled", authentication: "none" });
    expect(await provider.isAvailable()).toBe(false);
    await expectClaudeError(provider.run(request), "disabled");
    expect(loaded).toBe(false);
  });

  it("reports malformed configuration through status", async () => {
    const status = await new DisabledClaudeProvider(
      readClaudeConfig({ CLAUDE_PROVIDER: "nope" }),
    ).status();
    expect(status).toMatchObject({ state: "misconfigured" });
    expect(status.message).toContain('"nope"');
  });
});

describe("judgeAccount", () => {
  it("accepts a first-party subscription login", () => {
    expect(judgeAccount(READY_ACCOUNT, {})).toEqual({ ok: true, subscription: "Claude Max" });
  });

  it("rejects any API key source and third-party providers", () => {
    expect(judgeAccount({ ...READY_ACCOUNT, apiKeySource: "ANTHROPIC_API_KEY" }, {})).toMatchObject(
      { ok: false, state: "api-key-in-use" },
    );
    expect(judgeAccount({ ...READY_ACCOUNT, apiKeySource: "apiKeyHelper" }, {})).toMatchObject({
      ok: false,
      state: "api-key-in-use",
    });
    expect(judgeAccount({ apiProvider: "bedrock" }, {})).toMatchObject({
      ok: false,
      state: "api-key-in-use",
    });
  });

  it("treats a missing subscription as unauthenticated, unless a setup-token is configured", () => {
    expect(judgeAccount({ apiProvider: "firstParty" }, {})).toMatchObject({
      ok: false,
      state: "unauthenticated",
    });
    expect(
      judgeAccount({ apiProvider: "firstParty" }, { CLAUDE_CODE_OAUTH_TOKEN: SECRET }),
    ).toMatchObject({ ok: true });
  });
});

describe("SubscriptionClaudeProvider.status", () => {
  it("reports ready without sending any prompt (no usage consumed)", async () => {
    const { provider, sdk } = setup({});
    expect(await provider.status()).toMatchObject({
      state: "ready",
      subscription: "Claude Max",
      authentication: "claude-subscription",
    });
    expect(sdk.promptsSent).toEqual([]);
  });

  it("reports an unauthenticated environment with an actionable message", async () => {
    const { provider } = setup({ account: new Error("Not logged in · Please run /login") });
    const status = await provider.status();
    expect(status.state).toBe("unauthenticated");
    expect(status.message).toContain("npm run claude:setup");
  });

  it("reports SDK initialization failures", async () => {
    const provider = new SubscriptionClaudeProvider({
      config: readClaudeConfig({ CLAUDE_PROVIDER: "subscription" }),
      env: {},
      loadSdk: () =>
        Promise.reject(new Error("Cannot find module '@anthropic-ai/claude-agent-sdk'")),
    });
    expect(await provider.status()).toMatchObject({ state: "error" });
    await expectClaudeError(provider.run(request), "sdk-unavailable");
  });

  it("times out a hung account check", async () => {
    const { provider } = setup({ accountDelayMs: 5_000 }, { statusTimeoutMs: 20 });
    expect(await provider.status()).toMatchObject({ state: "error" });
  });

  it("mentions (by name only) API-key variables it ignores", async () => {
    const { provider } = setup(
      {},
      { env: { ANTHROPIC_API_KEY: "sk-ant-api03-realkeyrealkeyrealkey" } },
    );
    const status = await provider.status();
    expect(status.message).toContain("Ignored for this integration: ANTHROPIC_API_KEY");
    expect(JSON.stringify(status)).not.toContain("realkey");
  });

  it("never exposes the account email", async () => {
    const { provider } = setup({});
    expect(JSON.stringify(await provider.status())).not.toContain("dev@example.com");
  });
});

describe("SubscriptionClaudeProvider.run", () => {
  it("returns Claude's text using the subscription and hardened options", async () => {
    const { provider, sdk } = setup(
      { messages: [initMessage(), successResult("CLAUDE_LOCAL_OK")] },
      { env: { ANTHROPIC_API_KEY: "sk-ant-api03-mustnotbeused1234" } },
    );
    const response = await provider.run(request);
    expect(response).toMatchObject({ text: "CLAUDE_LOCAL_OK", model: "claude-opus-5-5" });
    expect(sdk.promptsSent).toEqual(["Say hi"]);

    const options = sdk.options[0]!;
    expect(options.env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(options).toMatchObject({
      settingSources: [],
      tools: [],
      allowedTools: [],
      mcpServers: {},
      maxTurns: 1,
      persistSession: false,
      systemPrompt: "You write JSON.",
      cwd: "/tmp/ccl-test",
    });
    await expect(
      options.canUseTool!("Bash", {}, { signal: new AbortController().signal } as never),
    ).resolves.toMatchObject({ behavior: "deny" });
  });

  it("refuses BEFORE sending the prompt when an API key is in use", async () => {
    const { provider, sdk } = setup({
      account: { ...READY_ACCOUNT, apiKeySource: "ANTHROPIC_API_KEY" },
    });
    await expectClaudeError(provider.run(request), "api-key-in-use");
    expect(sdk.promptsSent).toEqual([]);
  });

  it("refuses BEFORE sending the prompt when not signed in", async () => {
    const { provider, sdk } = setup({ account: { apiProvider: "firstParty" } });
    await expectClaudeError(provider.run(request), "unauthenticated");
    expect(sdk.promptsSent).toEqual([]);
  });

  it("aborts if the session itself reports an API key (second guard)", async () => {
    const { provider } = setup({
      messages: [initMessage("ANTHROPIC_API_KEY"), successResult("should not be returned")],
    });
    await expectClaudeError(provider.run(request), "api-key-in-use");
  });

  it("maps Claude request failures", async () => {
    const failed = setup({
      messages: [
        initMessage(),
        {
          type: "result",
          subtype: "error_during_execution",
          is_error: true,
          errors: ["upstream exploded"],
        },
      ],
    });
    expect(
      (await expectClaudeError(failed.provider.run(request), "request-failed")).message,
    ).toContain("upstream exploded");

    const limited = setup({
      messages: [initMessage(), { type: "assistant", error: "rate_limit", message: {} }],
    });
    await expectClaudeError(limited.provider.run(request), "rate-limited");

    const rejected = setup({
      messages: [initMessage(), { type: "assistant", error: "authentication_failed", message: {} }],
    });
    await expectClaudeError(rejected.provider.run(request), "unauthenticated");

    const noResult = setup({ messages: [initMessage()] });
    await expectClaudeError(noResult.provider.run(request), "request-failed");
  });

  it("propagates SDK errors as ClaudeErrors", async () => {
    const { provider } = setup({
      iterateError: new Error("Claude Code process exited with code 1"),
    });
    await expectClaudeError(provider.run(request), "request-failed");
    const auth = setup({ iterateError: new Error("OAuth token has expired") });
    await expectClaudeError(auth.provider.run(request), "unauthenticated");
  });

  it("times out", async () => {
    const { provider } = setup({ messages: [initMessage()], hang: true }, { timeoutMs: 30 });
    await expectClaudeError(provider.run(request), "timeout");
  });

  it("can be cancelled, including before it starts", async () => {
    const { provider } = setup({ messages: [initMessage()], hang: true });
    const controller = new AbortController();
    const pending = provider.run(request, controller.signal);
    setTimeout(() => controller.abort(), 10);
    await expectClaudeError(pending, "cancelled");

    const early = new AbortController();
    early.abort();
    await expectClaudeError(provider.run(request, early.signal), "cancelled");
  });

  it("validates the request shape", async () => {
    const { provider } = setup({});
    await expectClaudeError(provider.run({ system: "s", messages: [] }), "bad-request");
    await expectClaudeError(
      provider.run({ system: "s", messages: [{ role: "assistant", content: "x" }] }),
      "bad-request",
    );
  });

  it("never leaks the subscription token through errors or logs", async () => {
    const { provider, logs, sdk } = setup(
      { iterateError: new Error(`request failed for token ${SECRET}`) },
      { env: { CLAUDE_CODE_OAUTH_TOKEN: SECRET } },
    );
    const error = await expectClaudeError(provider.run(request), "request-failed");
    expect(error.message).not.toContain(SECRET);
    sdk.options[0]?.stderr?.(`debug: using ${SECRET}`);
    expect(logs.join("\n")).not.toContain(SECRET);
    expect(logs.join("\n")).toContain("[redacted]");
  });
});

describe("flattenConversation", () => {
  it("passes a single message through and labels repair context", () => {
    expect(flattenConversation(request)).toBe("Say hi");
    const text = flattenConversation({
      system: "",
      messages: [
        { role: "user", content: "Generate" },
        { role: "assistant", content: "{bad json" },
        { role: "user", content: "Fix: not JSON" },
      ],
    });
    expect(text).toBe(
      "Generate\n\n--- Your previous response ---\n{bad json\n\n--- Follow-up ---\nFix: not JSON",
    );
  });
});
