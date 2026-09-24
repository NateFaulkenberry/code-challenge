import type { Challenge } from "@/domain/challenge";
import type { LanguageId } from "@/domain/languages";
import type { ProviderId } from "@/domain/settings";
import type { ProviderStatus } from "./provider";
import type { GenerationRequest } from "./request";

export type GenerationStage =
  | { stage: "requesting"; attempt: number }
  | { stage: "validating"; attempt: number }
  | { stage: "loading-runtime"; attempt: number }
  | { stage: "testing"; attempt: number }
  | { stage: "repairing"; attempt: number; problems: string[] };

export interface GenerationHooks {
  signal: AbortSignal;
  onStage?: (stage: GenerationStage) => void;
}

/** Anything that can produce a validated challenge for a request. */
export interface ChallengeSource {
  readonly id: ProviderId;
  status(): ProviderStatus;
  /** Languages this source can currently produce. */
  availableLanguages(): LanguageId[];
  generate(request: GenerationRequest, hooks: GenerationHooks): Promise<Challenge>;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [],
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "GenerationError";
  }
}
