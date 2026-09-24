import { describe, expect, it, vi } from "vitest";
import { FIXTURE_LIST } from "../../../fixtures/challenges";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import { createChallengeSource } from "./factory";
import {
  LocalClaudeProvider,
  LocalClaudeStatusStore,
  localClaudeProviderStatus,
  type LocalClaudeAvailability,
} from "./local-claude";
import { SampleChallengeSource } from "./sample-source";
import type { LlmRequest } from "./provider";

const ready: LocalClaudeAvailability = {
  kind: "known",
  status: {
    provider: "subscription",
    state: "ready",
    authentication: "claude-subscription",
    subscription: "Claude Max",
    message: "ok",
  },
};

const llmRequest: LlmRequest = {
  prompt: { system: "sys", user: "generate", version: "v1" },
  request: {
    language: "typescript",
    difficulty: "beginner",
    category: "algorithms",
    archetype: "algorithm",
  },
  history: [
    { role: "assistant", content: "{}" },
    { role: "user", content: "fix it" },
  ],
  jsonSchema: { type: "object" },
};

const respond = (status: number, body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );

describe("LocalClaudeProvider", () => {
  it("posts the conversation to the same-origin local endpoint, never to Anthropic", async () => {
    const fetchMock = respond(200, { text: "{}", model: "claude-opus-5-5" });
    const provider = new LocalClaudeProvider(() => ready, fetchMock);
    await expect(provider.generate(llmRequest, new AbortController().signal)).resolves.toEqual({
      text: "{}",
      model: "claude-opus-5-5",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url as string).toMatch(/^\/__local\/claude\/generate$/);
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.stringify(init?.headers)).not.toMatch(/api-key|authorization/i);
    expect(JSON.parse(init?.body as string)).toEqual({
      system: "sys",
      messages: [
        { role: "user", content: "generate" },
        { role: "assistant", content: "{}" },
        { role: "user", content: "fix it" },
      ],
    });
  });

  it.each([
    [401, "auth"],
    [409, "auth"],
    [429, "rate-limit"],
    [503, "bad-request"],
    [504, "unknown"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const provider = new LocalClaudeProvider(
      () => ready,
      respond(status, { error: { code: "x", message: "why" } }),
    );
    await expect(provider.generate(llmRequest, new AbortController().signal)).rejects.toMatchObject(
      { kind, message: "why" },
    );
  });

  it("reports readiness and the local-only label", () => {
    expect(new LocalClaudeProvider(() => ready).status()).toEqual({
      state: "ready",
      label: "Claude — Local Only · Claude Max",
    });
    expect(localClaudeProviderStatus({ kind: "unsupported" })).toMatchObject({
      state: "needs-configuration",
      label: "Claude — Local Only",
    });
    expect(
      localClaudeProviderStatus({
        kind: "known",
        status: { ...ready.status, state: "unauthenticated", message: "Run npm run claude:setup" },
      }),
    ).toMatchObject({ reason: "Run npm run claude:setup" });
  });
});

describe("LocalClaudeStatusStore", () => {
  it("reports an unreachable server instead of throwing", async () => {
    const store = new LocalClaudeStatusStore(
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    expect(await store.refresh()).toEqual({
      kind: "unreachable",
      message: "The local dev server is not reachable.",
    });
  });

  it("stores the server's status", async () => {
    const store = new LocalClaudeStatusStore(respond(200, ready.status));
    await store.refresh();
    expect(store.getSnapshot()).toEqual(ready);
  });
});

describe("createChallengeSource with claude-local", () => {
  const deps = {
    samples: FIXTURE_LIST,
    getApiKey: () => "sk-ant-api03-should-never-be-used",
    availableLanguages: () => ["typescript" as const],
    knownChallenges: () => Promise.resolve([]),
    prepareRuntime: () => Promise.reject(new Error("unused")),
    localClaude: () => ready,
  };

  it("uses the local provider in local development", () => {
    const source = createChallengeSource(
      { ...DEFAULT_SETTINGS, provider: "claude-local" },
      { ...deps, localClaudeSupported: true },
    );
    expect(source.status()).toEqual({ state: "ready", label: "Claude — Local Only · Claude Max" });
  });

  it("can never create it in the public build — and never falls back to an API key", () => {
    const source = createChallengeSource(
      { ...DEFAULT_SETTINGS, provider: "claude-local" },
      { ...deps, localClaudeSupported: false },
    );
    expect(source).toBeInstanceOf(SampleChallengeSource);
  });
});
