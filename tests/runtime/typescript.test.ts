import { describe, expect, it } from "vitest";
import tsAdvanced from "../../fixtures/challenges/typescript-advanced";
import tsBeginner from "../../fixtures/challenges/typescript-beginner";
import { typescriptHandler } from "@/runtimes/typescript/handler";
import { recordingContext } from "../helpers/handler-context";
import { describeRuntimeContract } from "./contract";

describeRuntimeContract(
  "TypeScript",
  typescriptHandler,
  {
    hello: `const greeting: string = "hello";\nconsole.log(greeting);`,
    stderr: `console.error("oops");`,
    compileError: `const x: number = ;`,
    runtimeError: `const obj: any = undefined;\nobj.property;`,
  },
  [tsBeginner, tsAdvanced],
);

describe("TypeScript runtime specifics", () => {
  it("waits for timers before finishing a run", async () => {
    const ctx = recordingContext();
    const outcome = await typescriptHandler.execute(
      { source: `setTimeout(() => console.log("later"), 20);\nconsole.log("now");` },
      ctx,
    );
    expect(outcome.status).toBe("success");
    expect(ctx.stdoutText).toBe("now\nlater\n");
  });

  it("reports unhandled async errors as runtime errors", async () => {
    const ctx = recordingContext();
    const outcome = await typescriptHandler.execute(
      { source: `Promise.reject(new Error("async boom"));` },
      ctx,
    );
    expect(outcome.status).toBe("runtime-error");
    expect(ctx.stderrText).toContain("async boom");
  });

  it("reports the line of syntax errors", async () => {
    const outcome = await typescriptHandler.execute(
      { source: `const a = 1;\nconst b = ;\n` },
      recordingContext(),
    );
    expect(outcome.diagnostics[0]?.line).toBe(2);
  });

  it("rejects imports outside the allow-list", async () => {
    const ctx = recordingContext();
    const outcome = await typescriptHandler.execute(
      { source: `import fs from "fs";\nconsole.log(fs);` },
      ctx,
    );
    expect(outcome.status).toBe("runtime-error");
    expect(ctx.stderrText).toContain('Cannot import "fs"');
  });

  it("isolates module state between tests", async () => {
    const ctx = recordingContext();
    await typescriptHandler.runTests(
      {
        source: `let count = 0;\nexport const increment = () => ++count;`,
        prelude: `import { increment } from "./solution";`,
        cases: [
          { id: "first", code: `expect(increment()).toBe(1);` },
          { id: "second", code: `expect(increment()).toBe(1);` },
        ],
      },
      ctx,
    );
    expect(ctx.tests.map((t) => t.status)).toEqual(["pass", "pass"]);
  });

  it("distinguishes assertion failures from thrown errors", async () => {
    const ctx = recordingContext();
    await typescriptHandler.runTests(
      {
        source: `export const f = () => { throw new TypeError("bad"); };`,
        prelude: `import { f } from "./solution";`,
        cases: [
          { id: "fails", code: `expect(1).toBe(2);` },
          { id: "errors", code: `f();` },
        ],
      },
      ctx,
    );
    expect(ctx.tests.map((t) => t.status)).toEqual(["fail", "error"]);
    expect(ctx.tests[1]?.message).toContain("TypeError: bad");
  });

  it("times out a test whose promise never settles", async () => {
    const ctx = recordingContext();
    const { runJsTests } = await import("@/runtimes/js/runner");
    await runJsTests(
      {
        source: `export {};`,
        prelude: ``,
        cases: [{ id: "hangs", code: `await new Promise(() => {});` }],
      },
      { solutionFile: "solution.ts", jsx: false, modules: {}, testTimeoutMs: 30 },
      ctx,
    );
    expect(ctx.tests[0]?.status).toBe("timeout");
  });

  it("reports a test suite that cannot compile as a challenge defect", async () => {
    const outcome = await typescriptHandler.runTests(
      { source: `export {};`, prelude: ``, cases: [{ id: "broken", code: `expect(1).toBe(;` }] },
      recordingContext(),
    );
    expect(outcome.status).toBe("internal-error");
  });
});

describe("TypeScript runtime loop protection", () => {
  it("fails only the test with an infinite loop and keeps running the rest", async () => {
    const ctx = recordingContext();
    const { runJsTests } = await import("@/runtimes/js/runner");
    await runJsTests(
      {
        source: `export function spin(): void { while (true) {} }\nexport const ok = () => 1;`,
        prelude: `import { spin, ok } from "./solution";`,
        cases: [
          { id: "spins", code: `spin();` },
          { id: "fine", code: `expect(ok()).toBe(1);` },
        ],
      },
      { solutionFile: "solution.ts", jsx: false, modules: {}, loopBudgetMs: 50 },
      ctx,
    );
    expect(ctx.tests.map((t) => t.status)).toEqual(["error", "pass"]);
    expect(ctx.tests[0]?.message).toContain("infinite loop");
  });

  it("reports syntax errors sucrase lets through", async () => {
    const outcome = await typescriptHandler.execute(
      { source: `const x = 1;\nlet let = 2;` },
      recordingContext(),
    );
    expect(outcome.status).toBe("compile-error");
  });
});

describe("TypeScript runtime error locations", () => {
  it("reports stack frames with the user's line numbers", async () => {
    const ctx = recordingContext();
    await typescriptHandler.execute(
      { source: `const a = 1;\nconst b = 2;\nthrow new Error("line three");` },
      ctx,
    );
    expect(ctx.stderrText).toMatch(/solution\.ts:3:\d+/);
  });
});
