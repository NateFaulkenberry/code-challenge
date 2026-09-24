import { describe, expect, it } from "vitest";
import * as fixtures from "../../fixtures/challenges";
import { ChallengeDraftSchema, ChallengeSchema, hiddenTestCount, visibleTests } from "./challenge";

describe("challenge schema", () => {
  const all = Object.values(fixtures.FIXTURES);

  it.each(all.map((c) => [c.id, c] as const))("fixture %s is valid", (_id, challenge) => {
    expect(ChallengeSchema.safeParse(challenge).success).toBe(true);
  });

  it("rejects unknown languages and difficulties", () => {
    const [sample] = all;
    expect(ChallengeDraftSchema.safeParse({ ...sample, language: "cobol" }).success).toBe(false);
    expect(ChallengeDraftSchema.safeParse({ ...sample, difficulty: "trivial" }).success).toBe(
      false,
    );
  });

  it("rejects missing tests and malformed test ids", () => {
    const [sample] = all;
    expect(
      ChallengeDraftSchema.safeParse({ ...sample, tests: { prelude: "", cases: [] } }).success,
    ).toBe(false);
    const badId = { ...sample!.tests.cases[0], id: "Has Spaces" };
    expect(
      ChallengeDraftSchema.safeParse({ ...sample, tests: { prelude: "", cases: [badId] } }).success,
    ).toBe(false);
  });

  it("enforces size limits on untrusted code", () => {
    const [sample] = all;
    expect(
      ChallengeDraftSchema.safeParse({ ...sample, starterCode: "x".repeat(60_000) }).success,
    ).toBe(false);
  });

  it("separates visible and hidden tests", () => {
    const challenge = fixtures.FIXTURES["typescript-beginner"];
    expect(visibleTests(challenge).every((t) => !t.hidden)).toBe(true);
    expect(hiddenTestCount(challenge)).toBe(2);
  });
});
