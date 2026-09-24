import { describe, expect, it } from "vitest";
import tsAdvanced from "../../fixtures/challenges/typescript-advanced";
import { at, makeChallenge, passedAttempt } from "../../tests/helpers/factories";
import { createAttempt, updateSolution } from "./attempt";
import { computeStats } from "./stats";

describe("computeStats", () => {
  it("returns zeros for an empty history (no fake metrics)", () => {
    const stats = computeStats([]);
    expect(stats).toMatchObject({
      attempted: 0,
      completed: 0,
      byLanguage: [],
      averageRunsToPass: null,
      lastCompletedAt: null,
    });
  });

  it("derives every number from stored attempts", () => {
    const attempts = [
      passedAttempt(makeChallenge(), at(1), 3),
      passedAttempt(tsAdvanced, at(2), 1),
      passedAttempt(makeChallenge({ id: "py", language: "python" }), at(3), 2),
      updateSolution(createAttempt(makeChallenge({ id: "wip" }), at(0)), "x", at(4)),
      createAttempt(makeChallenge({ id: "fresh" }), at(0)),
    ];
    const stats = computeStats(attempts);
    expect(stats.completed).toBe(3);
    expect(stats.attempted).toBe(4); // fresh, untouched attempts don't count
    expect(stats.byLanguage).toEqual([
      { language: "typescript", completed: 2 },
      { language: "python", completed: 1 },
    ]);
    expect(stats.byDifficulty).toEqual({ beginner: 2, intermediate: 0, advanced: 1, expert: 0 });
    expect(stats.averageRunsToPass).toBe(2);
    expect(stats.lastCompletedAt).toBe(at(3).toISOString());
  });
});
