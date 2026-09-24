/**
 * Bug (design): the first offline provider returned the nearest fixture and
 * overwrote its difficulty/category to match the request, so a Beginner
 * sample could be presented as Expert.
 * Fix: SampleChallengeSource returns samples exactly as authored and rejects
 * combinations it doesn't have.
 */
import { describe, expect, it } from "vitest";
import { FIXTURE_LIST } from "../../fixtures/challenges";
import { SampleChallengeSource } from "@/services/generation/sample-source";

const hooks = { signal: new AbortController().signal };

describe("regression: sample challenges are never relabelled", () => {
  it("returns the sample unchanged", async () => {
    const source = new SampleChallengeSource(FIXTURE_LIST, () => 0);
    const challenge = await source.generate(
      { language: "typescript", difficulty: "beginner" },
      hooks,
    );
    expect(challenge).toBe(FIXTURE_LIST.find((f) => f.id === challenge.id));
    expect(challenge.difficulty).toBe("beginner");
  });

  it("rejects combinations with no sample instead of substituting one", async () => {
    const source = new SampleChallengeSource(FIXTURE_LIST);
    await expect(
      source.generate({ language: "typescript", difficulty: "expert" }, hooks),
    ).rejects.toThrow("no sample challenge");
  });
});
