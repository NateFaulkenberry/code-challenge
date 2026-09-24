import type { ProviderId } from "@/domain/settings";
import type { BuiltPrompt } from "./prompt-builder";
import type { ResolvedRequest } from "./request";

export type ProviderStatus =
  | { state: "ready"; label: string }
  | { state: "needs-configuration"; label: string; reason: string };

export interface LlmRequest {
  prompt: BuiltPrompt;
  request: ResolvedRequest;
  /** Earlier assistant output plus validator feedback, for repair attempts. */
  history: { role: "assistant" | "user"; content: string }[];
  jsonSchema: unknown;
}

export interface LlmResponse {
  text: string;
  model: string;
}

export interface LlmProvider {
  readonly id: ProviderId;
  status(): ProviderStatus;
  generate(request: LlmRequest, signal: AbortSignal): Promise<LlmResponse>;
}

export type ProviderErrorKind =
  | "auth"
  | "rate-limit"
  | "overloaded"
  | "network"
  | "bad-request"
  | "truncated"
  | "refused"
  | "unknown";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  /** Transient failures are worth retrying automatically. */
  get retryable(): boolean {
    return this.kind === "rate-limit" || this.kind === "overloaded" || this.kind === "network";
  }
}
