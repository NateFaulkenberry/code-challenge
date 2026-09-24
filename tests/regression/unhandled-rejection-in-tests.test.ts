/**
 * Bug: in the TypeScript runtime, a test that left a rejected promise
 * unawaited (common when a starter implementation is wrong) produced an
 * unhandled rejection in the host process instead of being attributed to
 * the user's code.
 * Fix: runJsTests subscribes to unhandled rejections for the whole run and
 * reports them on stderr.
 */
import { describe, expect, it } from "vitest";
import { runJsTests } from "@/runtimes/js/runner";
import { recordingContext } from "../helpers/handler-context";

describe("regression: unhandled rejections inside tests", () => {
  it("are reported on stderr and do not escape the runner", async () => {
    const ctx = recordingContext();
    const outcome = await runJsTests(
      {
        source: `export const leak = () => { Promise.reject(new Error("forgotten")); };`,
        prelude: `import { leak } from "./solution";`,
        cases: [{ id: "leaks", code: `leak();\nexpect(1).toBe(1);` }],
      },
      { solutionFile: "solution.ts", jsx: false, modules: {} },
      ctx,
    );
    expect(outcome.status).toBe("success");
    expect(ctx.tests[0]?.status).toBe("pass");
    expect(ctx.stderrText).toContain("Unhandled promise rejection");
    expect(ctx.stderrText).toContain("forgotten");
  });
});
