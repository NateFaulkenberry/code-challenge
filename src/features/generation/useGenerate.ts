import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "@/app/context";
import { createAttempt, type Attempt } from "@/domain/attempt";
import type { ChallengeSource, GenerationStage } from "@/services/generation/source";
import { GenerationError } from "@/services/generation/source";
import { ProviderError } from "@/services/generation/provider";
import type { GenerationRequest } from "@/services/generation/request";

export type GenerateState =
  | { phase: "idle" }
  | { phase: "generating"; stage?: GenerationStage }
  | { phase: "done"; attempt: Attempt }
  | { phase: "error"; message: string; details?: string };

export const STAGE_LABELS: Record<GenerationStage["stage"], string> = {
  requesting: "Asking the model for a challenge…",
  validating: "Validating the challenge definition…",
  "loading-runtime": "Loading the language runtime…",
  testing: "Running the reference solution against its tests…",
  repairing: "Validation found problems — asking the model to fix them…",
};

/** Drives one generation: source → validated challenge → persisted attempt. */
export function useGenerate(source: ChallengeSource) {
  const { attempts } = useServices();
  const [state, setState] = useState<GenerateState>({ phase: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const generate = useCallback(
    async (request: GenerationRequest): Promise<Attempt | undefined> => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setState({ phase: "generating" });
      try {
        const challenge = await source.generate(request, {
          signal: abort.signal,
          onStage: (stage) => setState({ phase: "generating", stage }),
        });
        // Samples keep stable ids: reopen an existing attempt rather than overwrite it.
        const attempt = attempts.get(challenge.id) ?? createAttempt(challenge, new Date());
        await attempts.save(attempt);
        setState({ phase: "done", attempt });
        return attempt;
      } catch (error) {
        if (abort.signal.aborted) {
          setState({ phase: "idle" });
          return undefined;
        }
        setState({ phase: "error", ...describeGenerationError(error) });
        return undefined;
      }
    },
    [attempts, source],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    setState({ phase: "idle" });
  }, []);

  return { state, generate, cancel };
}

export function describeGenerationError(error: unknown): { message: string; details?: string } {
  if (error instanceof GenerationError) {
    return {
      message: error.message,
      ...(error.problems.length ? { details: error.problems.join("\n") } : {}),
    };
  }
  if (error instanceof ProviderError)
    return { message: error.message, ...(error.details ? { details: error.details } : {}) };
  return {
    message: "Challenge generation failed unexpectedly.",
    details: error instanceof Error ? error.message : String(error),
  };
}
