import type { Challenge } from "@/domain/challenge";
import type { LanguageId } from "@/domain/languages";
import type { Settings } from "@/domain/settings";
import type { LanguageRuntime } from "@/runtimes/core/types";
import { AnthropicProvider } from "./anthropic-provider";
import {
  LOCAL_CLAUDE_SUPPORTED,
  LocalClaudeProvider,
  type LocalClaudeAvailability,
} from "./local-claude";
import { LlmChallengeSource, type KnownChallenge } from "./llm-source";
import { ProxyProvider } from "./proxy-provider";
import { SampleChallengeSource } from "./sample-source";
import type { ChallengeSource } from "./source";

export interface SourceDependencies {
  samples: readonly Challenge[];
  getApiKey: () => string | undefined;
  availableLanguages: () => LanguageId[];
  knownChallenges: () => Promise<KnownChallenge[]>;
  prepareRuntime: (language: LanguageId) => Promise<LanguageRuntime>;
  /** Local Claude status; only consulted in local development builds. */
  localClaude?: () => LocalClaudeAvailability;
  /** Defaults to the build flag; tests pass false to model the public build. */
  localClaudeSupported?: boolean;
}

export function createChallengeSource(
  settings: Settings,
  deps: SourceDependencies,
): ChallengeSource {
  const llm = (provider: AnthropicProvider | ProxyProvider | LocalClaudeProvider) =>
    new LlmChallengeSource({
      provider,
      availableLanguages: deps.availableLanguages,
      knownChallenges: deps.knownChallenges,
      prepareRuntime: deps.prepareRuntime,
      validationTimeoutMs: Math.max(settings.executionTimeoutMs, 15_000),
    });
  switch (settings.provider) {
    case "anthropic":
      return llm(
        new AnthropicProvider({ getApiKey: deps.getApiKey, model: settings.anthropicModel }),
      );
    case "proxy":
      return llm(new ProxyProvider({ url: settings.proxyUrl }));
    case "claude-local":
      // Never available in the public build: fall back to offline samples, never to an API.
      // The build-time constant comes first so production bundles drop the local provider entirely.
      if (!LOCAL_CLAUDE_SUPPORTED || deps.localClaudeSupported === false || !deps.localClaude) {
        return new SampleChallengeSource(deps.samples);
      }
      return llm(new LocalClaudeProvider(deps.localClaude));
    case "fixtures":
      return new SampleChallengeSource(deps.samples);
  }
}
