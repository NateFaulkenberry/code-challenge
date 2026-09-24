import { z } from "zod";
import { ChallengeSchema, type Challenge } from "./challenge";
import { TestRunResultSchema, summarizeTestRun, type TestRunResult } from "./execution";

export const ATTEMPT_SCHEMA_VERSION = 1;

export const ATTEMPT_STATUSES = ["generated", "in-progress", "passed"] as const;
export const AttemptStatusSchema = z.enum(ATTEMPT_STATUSES);
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;

export const ATTEMPT_STATUS_LABELS: Readonly<Record<AttemptStatus, string>> = {
  generated: "Not started",
  "in-progress": "In progress",
  passed: "Passed",
};

export const AttemptSchema = z.object({
  schemaVersion: z.literal(ATTEMPT_SCHEMA_VERSION),
  id: z.string().min(1),
  challenge: ChallengeSchema,
  status: AttemptStatusSchema,
  /** Current editor contents. */
  solution: z.string(),
  /** Exact source that passed the full suite. Kept even if the solution is later edited. */
  passedSolution: z.string().optional(),
  /** Owner's write-up shown in portfolio mode. */
  approachNotes: z.string().max(20_000).default(""),
  lastTestRun: TestRunResultSchema.optional(),
  testRunCount: z.number().int().nonnegative(),
  referenceRevealed: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export function createAttempt(challenge: Challenge, now: Date): Attempt {
  const timestamp = now.toISOString();
  return {
    schemaVersion: ATTEMPT_SCHEMA_VERSION,
    id: challenge.id,
    challenge,
    status: "generated",
    solution: challenge.starterCode,
    approachNotes: "",
    testRunCount: 0,
    referenceRevealed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Editing moves a fresh attempt into progress; a passed attempt stays passed. */
export function updateSolution(attempt: Attempt, solution: string, now: Date): Attempt {
  if (solution === attempt.solution) return attempt;
  return {
    ...attempt,
    solution,
    status: attempt.status === "generated" ? "in-progress" : attempt.status,
    updatedAt: now.toISOString(),
  };
}

/**
 * Records a test run. Only a run that included hidden tests and passed every
 * case can complete an attempt — saving or passing visible tests never does.
 */
export function recordTestRun(
  attempt: Attempt,
  run: TestRunResult,
  testedSource: string,
  now: Date,
): Attempt {
  const summary = summarizeTestRun(run);
  const completes = run.includedHidden && summary.allPassed;
  const timestamp = now.toISOString();
  return {
    ...attempt,
    lastTestRun: run,
    testRunCount: attempt.testRunCount + 1,
    status: completes || attempt.status === "passed" ? "passed" : "in-progress",
    passedSolution: completes ? testedSource : attempt.passedSolution,
    completedAt: completes ? (attempt.completedAt ?? timestamp) : attempt.completedAt,
    updatedAt: timestamp,
  };
}

export function revealReference(attempt: Attempt, now: Date): Attempt {
  if (attempt.referenceRevealed) return attempt;
  return { ...attempt, referenceRevealed: true, updatedAt: now.toISOString() };
}

export function resetToStarter(attempt: Attempt, now: Date): Attempt {
  return updateSolution(attempt, attempt.challenge.starterCode, now);
}
