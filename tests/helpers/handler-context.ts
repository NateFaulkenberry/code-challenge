import type { TestResult } from "@/domain/execution";
import type { HandlerContext } from "@/runtimes/core/types";

export interface RecordingContext extends HandlerContext {
  out: string[];
  err: string[];
  tests: TestResult[];
  started: string[];
  readonly stdoutText: string;
  readonly stderrText: string;
}

/** A HandlerContext that records everything, for driving handlers directly in tests. */
export function recordingContext(): RecordingContext {
  const out: string[] = [];
  const err: string[] = [];
  const tests: TestResult[] = [];
  const started: string[] = [];
  return {
    out,
    err,
    tests,
    started,
    get stdoutText() {
      return out.join("");
    },
    get stderrText() {
      return err.join("");
    },
    progress: () => undefined,
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    startTest: (id) => started.push(id),
    reportTest: (result) => tests.push(result),
  };
}
