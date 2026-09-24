import type { Challenge } from "@/domain/challenge";
import type { LanguageId } from "@/domain/languages";
import type { ProviderStatus } from "./provider";
import type { GenerationRequest } from "./request";
import { GenerationError, type ChallengeSource, type GenerationHooks } from "./source";

/**
 * Offline mode: serves the bundled sample challenges without an LLM. Samples
 * are returned exactly as authored — never relabelled to fit a request — and
 * keep their stable ids, so choosing one again resumes the existing attempt.
 */
export class SampleChallengeSource implements ChallengeSource {
  readonly id = "fixtures" as const;
  private cursor = 0;

  constructor(
    private readonly samples: readonly Challenge[],
    private readonly random: () => number = Math.random,
  ) {}

  status(): ProviderStatus {
    return { state: "ready", label: "Sample challenges (offline)" };
  }

  availableLanguages(): LanguageId[] {
    return [...new Set(this.samples.map((s) => s.language))];
  }

  matching(request: GenerationRequest): Challenge[] {
    return this.samples.filter(
      (s) =>
        (!request.language || s.language === request.language) &&
        (!request.difficulty || s.difficulty === request.difficulty) &&
        (!request.category || s.category === request.category) &&
        (!request.archetype || s.archetype === request.archetype),
    );
  }

  generate(request: GenerationRequest, hooks: GenerationHooks): Promise<Challenge> {
    hooks.onStage?.({ stage: "requesting", attempt: 1 });
    const pool = this.matching(request);
    if (pool.length === 0) {
      return Promise.reject(
        new GenerationError(
          "There is no sample challenge for that combination. Configure an LLM provider in Settings to generate new challenges.",
        ),
      );
    }
    const start = Math.floor(this.random() * pool.length);
    const sample = pool[(start + this.cursor++) % pool.length] as Challenge;
    return Promise.resolve(sample);
  }
}
