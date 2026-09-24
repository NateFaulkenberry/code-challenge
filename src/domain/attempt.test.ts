import { describe, expect, it } from "vitest";
import { at, makeChallenge, passingRun, T0 } from "../../tests/helpers/factories";
import {
  AttemptSchema,
  createAttempt,
  recordTestRun,
  resetToStarter,
  revealReference,
  updateSolution,
} from "./attempt";

describe("attempt lifecycle", () => {
  const challenge = makeChallenge();

  it("starts as generated with the starter code", () => {
    const attempt = createAttempt(challenge, T0);
    expect(attempt).toMatchObject({
      status: "generated",
      solution: challenge.starterCode,
      testRunCount: 0,
    });
    expect(AttemptSchema.safeParse(attempt).success).toBe(true);
  });

  it("moves to in-progress when edited", () => {
    const attempt = updateSolution(createAttempt(challenge, T0), "changed", at(1));
    expect(attempt.status).toBe("in-progress");
    expect(attempt.updatedAt).toBe(at(1).toISOString());
  });

  it("returns the same object when the solution is unchanged", () => {
    const attempt = createAttempt(challenge, T0);
    expect(updateSolution(attempt, attempt.solution, at(1))).toBe(attempt);
  });

  it("does not complete on a visible-only passing run", () => {
    const attempt = recordTestRun(
      createAttempt(challenge, T0),
      passingRun(challenge, false),
      "code",
      at(1),
    );
    expect(attempt.status).toBe("in-progress");
    expect(attempt.passedSolution).toBeUndefined();
    expect(attempt.testRunCount).toBe(1);
  });

  it("completes only when the full suite passes, snapshotting the tested source", () => {
    const attempt = recordTestRun(
      createAttempt(challenge, T0),
      passingRun(challenge),
      "passing code",
      at(2),
    );
    expect(attempt).toMatchObject({
      status: "passed",
      passedSolution: "passing code",
      completedAt: at(2).toISOString(),
    });
  });

  it("does not complete when any test fails", () => {
    const run = passingRun(challenge);
    run.results[0] = { id: run.results[0]!.id, status: "fail", message: "nope" };
    expect(recordTestRun(createAttempt(challenge, T0), run, "code", at(1)).status).toBe(
      "in-progress",
    );
  });

  it("stays passed (keeping the original snapshot and date) after later failing runs", () => {
    const passed = recordTestRun(createAttempt(challenge, T0), passingRun(challenge), "v1", at(1));
    const failing = { ...passingRun(challenge), results: [{ id: "x", status: "fail" as const }] };
    const later = recordTestRun(updateSolution(passed, "v2", at(2)), failing, "v2", at(3));
    expect(later).toMatchObject({
      status: "passed",
      passedSolution: "v1",
      completedAt: at(1).toISOString(),
      solution: "v2",
    });
  });

  it("keeps the first completion date when passing again", () => {
    const first = recordTestRun(createAttempt(challenge, T0), passingRun(challenge), "v1", at(1));
    const second = recordTestRun(first, passingRun(challenge), "v2", at(5));
    expect(second.completedAt).toBe(at(1).toISOString());
    expect(second.passedSolution).toBe("v2");
  });

  it("records reference reveal once", () => {
    const revealed = revealReference(createAttempt(challenge, T0), at(1));
    expect(revealed.referenceRevealed).toBe(true);
    expect(revealReference(revealed, at(2))).toBe(revealed);
  });

  it("resets to starter code", () => {
    const edited = updateSolution(createAttempt(challenge, T0), "mine", at(1));
    expect(resetToStarter(edited, at(2)).solution).toBe(challenge.starterCode);
  });
});
