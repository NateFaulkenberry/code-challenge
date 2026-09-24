# ADR-009: LLM Provider Architecture

## Status

Accepted — 2026-09-23

## Context

GitHub Pages is public, so no private key can be embedded. Generation must still work for the owner, must stay possible to proxy later, and the app must be useful with no LLM at all.

## Decision

```ts
interface LlmProvider {
  id: "anthropic" | "proxy" | "fixtures";
  status(): ProviderStatus;
  generate(req: LlmRequest, signal: AbortSignal): Promise<LlmResponse>;
}
```

- **AnthropicProvider (BYOK):** a direct `fetch` to `/v1/messages` with the `anthropic-dangerous-direct-browser-access` header and `output_config.format` JSON-schema structured output. The default model is `claude-opus-5-5` and the user can change it. The key is entered by the user, stored only in their browser, and preceded by an explicit exposure warning.
- **ProxyProvider:** posts the same request to a user-configured URL. There is no key in the browser, and the proxy owns auth, quotas and the provider key. No proxy ships in v1.
- **FixtureProvider:** serves deterministic fixture challenges. Used in dev, tests, E2E and offline demos.
- No SDK dependency. The request surface is small enough that `fetch` keeps the bundle and supply chain minimal.

## Alternatives Considered

- **`@anthropic-ai/sdk` in the browser**: works (`dangerouslyAllowBrowser`), but adds weight for one endpoint.
- **An OpenAI provider in v1**: browser CORS works but isn't officially supported. The interface accommodates it later.

## Consequences

- Anyone with access to the user's browser profile can read the key. The settings screen explains this.
- The model's structured-output schema and the app's Zod schema can't drift, because one is generated from the other.
