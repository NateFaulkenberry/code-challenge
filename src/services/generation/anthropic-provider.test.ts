import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider, ANTHROPIC_ENDPOINT } from "./anthropic-provider";
import type { LlmRequest } from "./provider";

const llmRequest: LlmRequest = {
  prompt: { system: "sys", user: "usr", version: "v1" },
  request: {
    language: "typescript",
    difficulty: "beginner",
    category: "algorithms",
    archetype: "algorithm",
  },
  history: [],
  jsonSchema: { type: "object" },
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function provider(fetchImpl: typeof fetch, key: string | null = "sk-ant-test") {
  return new AnthropicProvider({
    getApiKey: () => key ?? undefined,
    model: "claude-opus-5-5",
    fetch: fetchImpl,
  });
}

const signal = new AbortController().signal;

describe("AnthropicProvider", () => {
  it("needs configuration without a key", () => {
    expect(provider(vi.fn(), null).status().state).toBe("needs-configuration");
  });

  it("sends a browser-direct Messages API request with structured output", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, {
        model: "claude-opus-5-5",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "{}" }],
      }),
    );
    const result = await provider(fetchMock).generate(llmRequest, signal);
    expect(result).toEqual({ text: "{}", model: "claude-opus-5-5" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(ANTHROPIC_ENDPOINT);
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "claude-opus-5-5",
      system: "sys",
      messages: [{ role: "user", content: "usr" }],
      output_config: { format: { type: "json_schema", schema: { type: "object" } } },
    });
  });

  it.each([
    [401, "auth"],
    [429, "rate-limit"],
    [529, "overloaded"],
    [400, "bad-request"],
    [418, "unknown"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(status, { error: { message: "nope" } }));
    await expect(provider(fetchMock).generate(llmRequest, signal)).rejects.toMatchObject({ kind });
  });

  it("falls back to prompt-only JSON when structured output is rejected", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(400, { error: { message: "output_config.format is not supported" } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { content: [{ type: "text", text: "{}" }] }));
    await provider(fetchMock).generate(llmRequest, signal);
    const retryBody = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(retryBody).not.toHaveProperty("output_config");
  });

  it("reports truncation and refusals", async () => {
    const truncated = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(200, { stop_reason: "max_tokens", content: [] }));
    await expect(provider(truncated).generate(llmRequest, signal)).rejects.toMatchObject({
      kind: "truncated",
    });
    const refused = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(200, { stop_reason: "refusal", content: [] }));
    await expect(provider(refused).generate(llmRequest, signal)).rejects.toMatchObject({
      kind: "refused",
    });
  });

  it("maps network failures", async () => {
    const failing = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(provider(failing).generate(llmRequest, signal)).rejects.toMatchObject({
      kind: "network",
    });
  });
});
