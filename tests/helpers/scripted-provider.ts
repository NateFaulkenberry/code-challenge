import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  ProviderStatus,
} from "@/services/generation/provider";

/** An LlmProvider that replays scripted responses (strings or errors) and records requests. */
export class ScriptedProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  readonly requests: LlmRequest[] = [];

  constructor(private readonly script: (string | Error)[]) {}

  status(): ProviderStatus {
    return { state: "ready", label: "Scripted" };
  }

  generate(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(structuredClone(request));
    const next = this.script.shift();
    if (next === undefined)
      return Promise.reject(new Error("ScriptedProvider ran out of responses"));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve({ text: next, model: "scripted-model" });
  }
}
