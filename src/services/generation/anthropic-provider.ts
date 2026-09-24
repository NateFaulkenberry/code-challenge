import {
  ProviderError,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type ProviderStatus,
} from "./provider";

export const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 16_000;

interface AnthropicOptions {
  getApiKey: () => string | undefined;
  model: string;
  fetch?: typeof fetch;
}

interface MessagesResponse {
  model?: string;
  stop_reason?: string;
  content?: { type: string; text?: string }[];
  error?: { type?: string; message?: string };
}

/**
 * Bring-your-own-key provider. Calls the Messages API directly from the
 * browser (the API allows this with an explicit opt-in header). The key never
 * leaves the user's machine except in this request.
 */
export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  private structuredOutput = true;

  constructor(private readonly options: AnthropicOptions) {}

  status(): ProviderStatus {
    return this.options.getApiKey()
      ? { state: "ready", label: `Anthropic · ${this.options.model}` }
      : {
          state: "needs-configuration",
          label: "Anthropic",
          reason: "Add your Anthropic API key in Settings.",
        };
  }

  async generate(request: LlmRequest, signal: AbortSignal): Promise<LlmResponse> {
    const apiKey = this.options.getApiKey();
    if (!apiKey) throw new ProviderError("auth", "No Anthropic API key is configured.");
    try {
      return await this.send(apiKey, request, signal);
    } catch (error) {
      // If the model/account rejects structured output, fall back to prompt-only JSON once.
      if (
        error instanceof ProviderError &&
        error.kind === "bad-request" &&
        this.structuredOutput &&
        /output_config|format|schema/i.test(error.details ?? "")
      ) {
        this.structuredOutput = false;
        return this.send(apiKey, request, signal);
      }
      throw error;
    }
  }

  private async send(
    apiKey: string,
    request: LlmRequest,
    signal: AbortSignal,
  ): Promise<LlmResponse> {
    const body = {
      model: this.options.model,
      max_tokens: MAX_TOKENS,
      system: request.prompt.system,
      messages: [{ role: "user", content: request.prompt.user }, ...request.history],
      ...(this.structuredOutput
        ? { output_config: { format: { type: "json_schema", schema: request.jsonSchema } } }
        : {}),
    };

    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(ANTHROPIC_ENDPOINT, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ProviderError(
        "network",
        "Could not reach the Anthropic API. Check your connection.",
        String(error),
      );
    }

    const payload = (await response.json().catch(() => ({}))) as MessagesResponse;
    if (!response.ok) throw errorForStatus(response.status, payload.error?.message);

    if (payload.stop_reason === "max_tokens") {
      throw new ProviderError(
        "truncated",
        "The model ran out of output tokens before finishing the challenge.",
      );
    }
    if (payload.stop_reason === "refusal") {
      throw new ProviderError("refused", "The model declined to generate this challenge.");
    }
    const text = (payload.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");
    if (!text) throw new ProviderError("unknown", "The model returned no text.");
    return { text, model: payload.model ?? this.options.model };
  }
}

function errorForStatus(status: number, message = ""): ProviderError {
  switch (status) {
    case 401:
    case 403:
      return new ProviderError("auth", "The Anthropic API rejected the API key.", message);
    case 429:
      return new ProviderError(
        "rate-limit",
        "Rate limited by the Anthropic API. Try again shortly.",
        message,
      );
    case 500:
    case 502:
    case 503:
    case 529:
      return new ProviderError(
        "overloaded",
        "The Anthropic API is temporarily unavailable.",
        message,
      );
    case 400:
    case 404:
    case 413:
      return new ProviderError("bad-request", "The Anthropic API rejected the request.", message);
    default:
      return new ProviderError(
        "unknown",
        `Unexpected response from the Anthropic API (HTTP ${status}).`,
        message,
      );
  }
}
