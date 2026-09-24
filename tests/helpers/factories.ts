import { createAttempt, recordTestRun, type Attempt } from "@/domain/attempt";
import type { Challenge } from "@/domain/challenge";
import type { TestRunResult } from "@/domain/execution";
import tsBeginner from "../../fixtures/challenges/typescript-beginner";

export const T0 = new Date("2026-09-20T12:00:00.000Z");

export function at(minutes: number): Date {
  return new Date(T0.getTime() + minutes * 60_000);
}

export function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return { ...tsBeginner, ...overrides };
}

export function passingRun(challenge: Challenge, includedHidden = true): TestRunResult {
  return {
    execution: {
      status: "success",
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 5,
      truncated: false,
      diagnostics: [],
    },
    results: challenge.tests.cases
      .filter((c) => includedHidden || !c.hidden)
      .map((c) => ({ id: c.id, status: "pass" as const })),
    includedHidden,
    finishedAt: T0.toISOString(),
  };
}

export function passedAttempt(challenge: Challenge, completedAt: Date, runs = 1): Attempt {
  let attempt = createAttempt(challenge, completedAt);
  for (let i = 1; i < runs; i++) {
    attempt = recordTestRun(
      attempt,
      { ...passingRun(challenge), includedHidden: false },
      attempt.solution,
      completedAt,
    );
  }
  return recordTestRun(attempt, passingRun(challenge), challenge.referenceSolution, completedAt);
}
