import { ChallengeDraftSchema, type ChallengeDraft } from "@/domain/challenge";
import { summarizeTestRun } from "@/domain/execution";
import type { LanguageRuntime } from "@/runtimes/core/types";
import { checkLanguageRules } from "./language-rules";
import type { ResolvedRequest } from "./request";

export type DraftValidation =
  { ok: true; draft: ChallengeDraft } | { ok: false; problems: string[] };

/** Schema + semantic checks. Everything here is cheap and runs before any code executes. */
export function validateDraft(raw: unknown, request: ResolvedRequest): DraftValidation {
  if (raw === undefined)
    return { ok: false, problems: ["The response did not contain a JSON object."] };
  const parsed = ChallengeDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues
        .slice(0, 15)
        .map((issue) => `Field \`${issue.path.join(".") || "(root)"}\`: ${issue.message}`),
    };
  }
  const draft = parsed.data;
  const problems: string[] = [];
  for (const key of ["language", "difficulty", "category", "archetype"] as const) {
    if (draft[key] !== request[key])
      problems.push(`\`${key}\` is "${draft[key]}" but "${request[key]}" was requested.`);
  }
  const ids = draft.tests.cases.map((c) => c.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length)
    problems.push(`Test ids must be unique; duplicated: ${[...new Set(duplicates)].join(", ")}.`);
  if (!draft.tests.cases.some((c) => !c.hidden))
    problems.push("At least one test must be visible (hidden: false).");
  if (!draft.tests.cases.some((c) => c.hidden))
    problems.push("At least one test must be hidden (hidden: true).");
  if (draft.starterCode.trim() === draft.referenceSolution.trim())
    problems.push("The starter code is identical to the reference solution.");
  problems.push(
    ...checkLanguageRules(draft.language, {
      solution: draft.referenceSolution,
      starter: draft.starterCode,
      tests: [draft.tests.prelude, ...draft.tests.cases.map((c) => c.code)].join("\n"),
    }),
  );
  return problems.length ? { ok: false, problems } : { ok: true, draft };
}

/**
 * Executes the draft in the same runtime that will run the user's code:
 * the reference must pass every test; the starter must run but not pass.
 */
export async function validateInRuntime(
  draft: ChallengeDraft,
  runtime: LanguageRuntime,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const cases = draft.tests.cases.map(({ id, code }) => ({ id, code }));
  const base = {
    prelude: draft.tests.prelude,
    cases,
    includedHidden: true,
    timeoutMs,
    ...(signal ? { signal } : {}),
  };
  const problems: string[] = [];

  const reference = await runtime.runTests({ ...base, source: draft.referenceSolution });
  if (reference.execution.status !== "success") {
    problems.push(
      `The reference solution did not run successfully (${reference.execution.status}): ${reference.execution.message ?? ""} ${reference.execution.stderr.slice(0, 1_500)}`.trim(),
    );
  }
  for (const result of reference.results) {
    if (result.status !== "pass") {
      const name = draft.tests.cases.find((c) => c.id === result.id)?.name ?? result.id;
      problems.push(
        `The reference solution fails test "${result.id}" (${name}): ${result.status}${result.message ? ` — ${result.message.slice(0, 500)}` : ""}`,
      );
    }
  }
  if (signal?.aborted) return problems;

  const starter = await runtime.runTests({ ...base, source: draft.starterCode });
  if (starter.execution.status === "compile-error") {
    problems.push(
      `The starter code does not compile: ${starter.execution.message ?? ""} ${starter.execution.stderr.slice(0, 1_000)}`.trim(),
    );
  } else if (starter.execution.status === "success" && summarizeTestRun(starter).allPassed) {
    problems.push(
      "The starter code already passes every test, so the challenge is trivial. Make the starter a stub or a flawed implementation.",
    );
  }
  return problems;
}
