import { z } from "zod";

export const EXECUTION_STATUSES = [
  "success",
  "runtime-error",
  "compile-error",
  "timeout",
  "cancelled",
  "internal-error",
] as const;

export const ExecutionStatusSchema = z.enum(EXECUTION_STATUSES);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const DiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const ExecutionResultSchema = z.object({
  status: ExecutionStatusSchema,
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().nonnegative(),
  /** True when stdout or stderr exceeded the output cap and was cut. */
  truncated: z.boolean(),
  diagnostics: z.array(DiagnosticSchema),
  /** Short human-readable summary for non-success states. */
  message: z.string().optional(),
});
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

export const TEST_STATUSES = ["pass", "fail", "error", "timeout", "not-run"] as const;
export const TestStatusSchema = z.enum(TEST_STATUSES);
export type TestStatus = z.infer<typeof TestStatusSchema>;

export const TestResultSchema = z.object({
  id: z.string(),
  status: TestStatusSchema,
  message: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
});
export type TestResult = z.infer<typeof TestResultSchema>;

export const TestRunResultSchema = z.object({
  execution: ExecutionResultSchema,
  results: z.array(TestResultSchema),
  /** Whether hidden tests were part of this run. */
  includedHidden: z.boolean(),
  finishedAt: z.iso.datetime(),
});
export type TestRunResult = z.infer<typeof TestRunResultSchema>;

export interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
}

export function summarizeTestRun(run: Pick<TestRunResult, "results">): TestRunSummary {
  const total = run.results.length;
  const passed = run.results.filter((r) => r.status === "pass").length;
  return { total, passed, failed: total - passed, allPassed: total > 0 && passed === total };
}

export const STORED_OUTPUT_LIMIT = 8 * 1024;

/** Trims console output before persisting a run, so history doesn't accumulate large logs. */
export function compactTestRun(run: TestRunResult, limit = STORED_OUTPUT_LIMIT): TestRunResult {
  const cut = (text: string) => (text.length > limit ? text.slice(0, limit) : text);
  const truncated =
    run.execution.truncated ||
    run.execution.stdout.length > limit ||
    run.execution.stderr.length > limit;
  return {
    ...run,
    execution: {
      ...run.execution,
      stdout: cut(run.execution.stdout),
      stderr: cut(run.execution.stderr),
      truncated,
    },
  };
}
