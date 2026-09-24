import { describe, expect, it } from "vitest";
import type { Challenge } from "@/domain/challenge";
import type { RuntimeHandler } from "@/runtimes/core/types";
import { recordingContext } from "../helpers/handler-context";

export interface ContractPrograms {
  /** Prints exactly "hello" + newline to stdout. */
  hello: string;
  /** Writes "oops" to stderr and completes. */
  stderr: string;
  /** Fails to compile / parse. */
  compileError: string;
  /** Compiles, then fails at run time. */
  runtimeError: string;
}

/**
 * The behavioural contract every language handler must satisfy. Each runtime
 * test file calls this with small programs in its own language.
 */
export function describeRuntimeContract(
  name: string,
  handler: RuntimeHandler,
  programs: ContractPrograms,
  fixtures: readonly Challenge[],
): void {
  describe(`${name} runtime contract`, () => {
    it("initializes", async () => {
      await expect(handler.init(recordingContext())).resolves.toBeUndefined();
    });

    it("captures stdout on success", async () => {
      const ctx = recordingContext();
      const outcome = await handler.execute({ source: programs.hello }, ctx);
      expect(outcome.status).toBe("success");
      expect(ctx.stdoutText).toBe("hello\n");
    });

    it("captures stderr", async () => {
      const ctx = recordingContext();
      await handler.execute({ source: programs.stderr }, ctx);
      expect(ctx.stderrText).toContain("oops");
    });

    it("reports compile errors", async () => {
      const outcome = await handler.execute({ source: programs.compileError }, recordingContext());
      expect(outcome.status).toBe("compile-error");
    });

    it("reports runtime errors", async () => {
      const ctx = recordingContext();
      const outcome = await handler.execute({ source: programs.runtimeError }, ctx);
      expect(outcome.status).toBe("runtime-error");
      expect(ctx.stderrText.length).toBeGreaterThan(0);
    });

    for (const challenge of fixtures) {
      describe(`fixture: ${challenge.title}`, () => {
        const cases = challenge.tests.cases.map(({ id, code }) => ({ id, code }));

        it("reference solution passes every test", async () => {
          const ctx = recordingContext();
          const outcome = await handler.runTests(
            { source: challenge.referenceSolution, prelude: challenge.tests.prelude, cases },
            ctx,
          );
          expect(outcome.status, outcome.message).toBe("success");
          expect(ctx.tests.map((t) => [t.id, t.status, t.message])).toEqual(
            cases.map((c) => [c.id, "pass", undefined]),
          );
        });

        it("starter code does not pass every test", async () => {
          const ctx = recordingContext();
          await handler.runTests(
            { source: challenge.starterCode, prelude: challenge.tests.prelude, cases },
            ctx,
          );
          expect(
            ctx.tests.some((t) => t.status !== "pass") || ctx.tests.length < cases.length,
          ).toBe(true);
        });
      });
    }
  });
}
