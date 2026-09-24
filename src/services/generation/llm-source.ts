import {
  CHALLENGE_SCHEMA_VERSION,
  ChallengeSchema,
  type Challenge,
  type ChallengeDraft,
} from "@/domain/challenge";
import { findDuplicate, fingerprintChallenge } from "@/domain/fingerprint";
import type { LanguageId } from "@/domain/languages";
import type { LanguageRuntime } from "@/runtimes/core/types";
import { slugify } from "@/utils/slug";
import { challengeDraftJsonSchema, extractJson } from "./json";
import { buildGenerationPrompt, buildRepairPrompt, GENERATOR_VERSION } from "./prompt-builder";
import { ProviderError, type LlmProvider, type LlmRequest, type ProviderStatus } from "./provider";
import { resolveRequest, type GenerationRequest, type HistoryEntry, type Random } from "./request";
import { GenerationError, type ChallengeSource, type GenerationHooks } from "./source";
import { validateDraft, validateInRuntime } from "./validator";

export interface KnownChallenge extends HistoryEntry {
  id: string;
  title: string;
  fingerprint: string;
}

export interface LlmSourceDependencies {
  provider: LlmProvider;
  /** Languages with a working runtime; generation needs one to validate. */
  availableLanguages: () => LanguageId[];
  /** Existing challenges (newest first) for variety and duplicate detection. */
  knownChallenges: () => Promise<KnownChallenge[]>;
  prepareRuntime: (language: LanguageId) => Promise<LanguageRuntime>;
  validationTimeoutMs: number;
  maxAttempts?: number;
  random?: Random;
  now?: () => Date;
  newId?: () => string;
  /** Backoff before retrying transient provider errors (tests pass 0). */
  retryDelayMs?: number;
}

/**
 * The generation pipeline (ADR-004):
 * resolve → prompt → provider → parse → schema/semantic checks →
 * duplicate check → runtime validation → accept, with bounded repair loops
 * that feed validator findings back to the model.
 */
export class LlmChallengeSource implements ChallengeSource {
  readonly id;

  constructor(private readonly deps: LlmSourceDependencies) {
    this.id = deps.provider.id;
  }

  status(): ProviderStatus {
    return this.deps.provider.status();
  }

  availableLanguages(): LanguageId[] {
    return this.deps.availableLanguages();
  }

  async generate(partial: GenerationRequest, hooks: GenerationHooks): Promise<Challenge> {
    const status = this.status();
    if (status.state !== "ready") throw new GenerationError(status.reason);

    const known = await this.deps.knownChallenges();
    const request = resolveRequest(partial, {
      availableLanguages: this.availableLanguages(),
      history: known,
      ...(this.deps.random ? { random: this.deps.random } : {}),
    });
    if (!this.availableLanguages().includes(request.language)) {
      throw new GenerationError(
        `Challenges can't be generated for ${request.language} because its runtime is unavailable.`,
      );
    }

    const prompt = buildGenerationPrompt({
      request,
      avoidTitles: known.filter((k) => k.language === request.language).map((k) => k.title),
    });
    const llmRequest: LlmRequest = {
      prompt,
      request,
      history: [],
      jsonSchema: challengeDraftJsonSchema(),
    };
    const maxAttempts = this.deps.maxAttempts ?? 3;
    let lastProblems: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      hooks.onStage?.({ stage: "requesting", attempt });
      const response = await this.callProvider(llmRequest, hooks.signal);

      hooks.onStage?.({ stage: "validating", attempt });
      const problems = await this.check(response.text, request, known, hooks, attempt);
      if (problems.ok) return this.accept(problems.draft, response.model);

      lastProblems = problems.problems;
      if (attempt < maxAttempts) {
        hooks.onStage?.({ stage: "repairing", attempt, problems: lastProblems });
        llmRequest.history.push(
          { role: "assistant", content: response.text },
          { role: "user", content: buildRepairPrompt(lastProblems) },
        );
      }
    }
    throw new GenerationError(
      `The generated challenge failed validation ${maxAttempts} times and was discarded.`,
      lastProblems,
    );
  }

  private async check(
    text: string,
    request: ReturnType<typeof resolveRequest>,
    known: readonly KnownChallenge[],
    hooks: GenerationHooks,
    attempt: number,
  ): Promise<{ ok: true; draft: ChallengeDraft } | { ok: false; problems: string[] }> {
    const validation = validateDraft(extractJson(text), request);
    if (!validation.ok) return validation;
    const draft = validation.draft;

    const duplicate = findDuplicate(fingerprintChallenge(draft), known);
    if (duplicate) {
      return {
        ok: false,
        problems: [
          `The challenge is too similar to an existing one ("${duplicate.title}"). Choose a clearly different scenario.`,
        ],
      };
    }

    hooks.onStage?.({ stage: "loading-runtime", attempt });
    const runtime = await this.deps.prepareRuntime(draft.language);
    const support = runtime.isSupported();
    if (!support.supported) throw new GenerationError(support.reason);
    hooks.onStage?.({ stage: "testing", attempt });
    const problems = await validateInRuntime(
      draft,
      runtime,
      this.deps.validationTimeoutMs,
      hooks.signal,
    );
    if (hooks.signal.aborted) throw new DOMException("Generation was cancelled.", "AbortError");
    return problems.length ? { ok: false, problems } : { ok: true, draft };
  }

  private async callProvider(request: LlmRequest, signal: AbortSignal) {
    try {
      return await this.deps.provider.generate(request, signal);
    } catch (error) {
      if (error instanceof ProviderError && error.retryable) {
        await delay(this.deps.retryDelayMs ?? 2_000, signal);
        return this.deps.provider.generate(request, signal);
      }
      throw error;
    }
  }

  private accept(draft: ChallengeDraft, model: string): Challenge {
    const now = (this.deps.now ?? (() => new Date()))();
    const id = (this.deps.newId ?? (() => crypto.randomUUID()))();
    return ChallengeSchema.parse({
      ...draft,
      schemaVersion: CHALLENGE_SCHEMA_VERSION,
      id,
      slug: slugify(draft.title),
      fingerprint: fingerprintChallenge(draft),
      provenance: {
        source: "llm",
        generatorVersion: GENERATOR_VERSION,
        model,
        generatedAt: now.toISOString(),
      },
    });
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Generation was cancelled.", "AbortError"));
    });
  });
}
