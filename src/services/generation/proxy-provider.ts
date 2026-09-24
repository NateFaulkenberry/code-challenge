import {
  ProviderError,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type ProviderStatus,
} from "./provider";

/**
 * Forwards the request to a user-configured proxy that owns the provider key,
 * auth and quotas. Contract: POST JSON `{ system, messages, jsonSchema }` →
 * `{ text, model }`. No proxy ships with the app (ADR-009).
 */
export class ProxyProvider implements LlmProvider {
  readonly id = "proxy" as const;

  constructor(private readonly options: { url: string; fetch?: typeof fetch }) {}

  status(): ProviderStatus {
    return this.options.url
      ? { state: "ready", label: `Proxy · ${new URL(this.options.url).host}` }
      : { state: "needs-configuration", label: "Proxy", reason: "Set a proxy URL in Settings." };
  }

  async generate(request: LlmRequest, signal: AbortSignal): Promise<LlmResponse> {
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(this.options.url, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system: request.prompt.system,
          messages: [{ role: "user", content: request.prompt.user }, ...request.history],
          jsonSchema: request.jsonSchema,
          promptVersion: request.prompt.version,
        }),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ProviderError("network", "Could not reach the generation proxy.", String(error));
    }
    if (response.status === 429)
      throw new ProviderError("rate-limit", "The proxy's quota was exceeded.");
    if (!response.ok)
      throw new ProviderError("unknown", `The proxy returned HTTP ${response.status}.`);
    const payload = (await response.json().catch(() => undefined)) as
      Partial<LlmResponse> | undefined;
    if (typeof payload?.text !== "string")
      throw new ProviderError("unknown", "The proxy returned an invalid response.");
    return {
      text: payload.text,
      model: typeof payload.model === "string" ? payload.model : "proxy",
    };
  }
}
