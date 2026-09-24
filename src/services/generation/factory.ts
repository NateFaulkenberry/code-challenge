import type { Challenge } from "@/domain/challenge";
import type { LanguageId } from "@/domain/languages";
import type { Settings } from "@/domain/settings";
import type { LanguageRuntime } from "@/runtimes/core/types";
import { AnthropicProvider } from "./anthropic-provider";
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
}

export function createChallengeSource(
  settings: Settings,
  deps: SourceDependencies,
): ChallengeSource {
  const llm = (provider: AnthropicProvider | ProxyProvider) =>
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
    case "fixtures":
      return new SampleChallengeSource(deps.samples);
  }
}
