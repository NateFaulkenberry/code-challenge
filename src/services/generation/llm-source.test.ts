import { describe, expect, it } from "vitest";
import tsAdvanced from "../../../fixtures/challenges/typescript-advanced";
import { createInProcessRuntime } from "../../../tests/helpers/in-process-runtime";
import { ScriptedProvider } from "../../../tests/helpers/scripted-provider";
import { ChallengeDraftSchema } from "@/domain/challenge";
import { typescriptHandler } from "@/runtimes/typescript/handler";
import { LlmChallengeSource, type KnownChallenge } from "./llm-source";
import { ProviderError } from "./provider";
import { GenerationError, type GenerationStage } from "./source";

const request = {
  language: "typescript",
  difficulty: "advanced",
  category: "async",
  archetype: "caching",
} as const;
const validText = JSON.stringify(ChallengeDraftSchema.parse(tsAdvanced));

function setup(script: (string | Error)[], known: KnownChallenge[] = []) {
  const provider = new ScriptedProvider(script);
  const { runtime } = createInProcessRuntime("typescript", typescriptHandler);
  const source = new LlmChallengeSource({
    provider,
    availableLanguages: () => ["typescript"],
    knownChallenges: () => Promise.resolve(known),
    prepareRuntime: () => Promise.resolve(runtime),
    validationTimeoutMs: 5_000,
    retryDelayMs: 0,
    now: () => new Date("2026-09-23T10:00:00.000Z"),
    newId: () => "generated-id",
  });
  const stages: GenerationStage["stage"][] = [];
  const hooks = {
    signal: new AbortController().signal,
    onStage: (s: GenerationStage) => stages.push(s.stage),
  };
  return { provider, source, stages, hooks };
}

describe("LlmChallengeSource", () => {
  it("accepts a valid, runtime-verified challenge and assigns identity/provenance", async () => {
    const { source, stages, hooks } = setup([validText]);
    const challenge = await source.generate(request, hooks);
    expect(challenge).toMatchObject({
      id: "generated-id",
      slug: "request-deduplication-cache",
      provenance: {
        source: "llm",
        generatorVersion: "challenge-generator-v1",
        model: "scripted-model",
        generatedAt: "2026-09-23T10:00:00.000Z",
      },
    });
    expect(stages).toEqual(["requesting", "validating", "loading-runtime", "testing"]);
  });

  it("repairs malformed JSON by sending the problems back to the model", async () => {
    const { source, provider, stages, hooks } = setup(["this is not json", validText]);
    await source.generate(request, hooks);
    expect(stages).toContain("repairing");
    const repair = provider.requests[1]?.history;
    expect(repair?.[0]).toEqual({ role: "assistant", content: "this is not json" });
    expect(repair?.[1]?.content).toContain("did not contain a JSON object");
  });

  it("repairs a reference solution that fails its own tests", async () => {
    const broken = JSON.stringify({
      ...(JSON.parse(validText) as object),
      referenceSolution: tsAdvanced.starterCode + "\n// wrong",
    });
    const { source, provider, hooks } = setup([broken, validText]);
    await source.generate(request, hooks);
    expect(provider.requests[1]?.history[1]?.content).toContain("reference solution fails test");
  });

  it("gives up after the attempt budget with the last problems", async () => {
    const { source, hooks } = setup(["{}", "{}", "{}"]);
    const error = await source.generate(request, hooks).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GenerationError);
    expect((error as GenerationError).problems.some((p) => p.includes("title"))).toBe(true);
  });

  it("rejects near-duplicates of known challenges", async () => {
    const known: KnownChallenge[] = [{ ...tsAdvanced, id: "old" }];
    const { source, provider, hooks } = setup([validText, validText, validText], known);
    await expect(source.generate(request, hooks)).rejects.toThrow("failed validation");
    expect(provider.requests[1]?.history[1]?.content).toContain("too similar");
    expect(provider.requests[0]?.prompt.system).toContain("- Request Deduplication Cache");
  });

  it("retries transient provider errors once", async () => {
    const { source, hooks } = setup([new ProviderError("overloaded", "busy"), validText]);
    await expect(source.generate(request, hooks)).resolves.toMatchObject({ id: "generated-id" });
  });

  it("does not retry authentication errors", async () => {
    const { source, hooks } = setup([new ProviderError("auth", "bad key"), validText]);
    await expect(source.generate(request, hooks)).rejects.toMatchObject({ kind: "auth" });
  });

  it("refuses languages without an available runtime", async () => {
    const { source, hooks } = setup([validText]);
    await expect(source.generate({ ...request, language: "java" }, hooks)).rejects.toThrow(
      "runtime is unavailable",
    );
  });
});
