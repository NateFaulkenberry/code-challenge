import { createRequire } from "node:module";
import { dirname } from "node:path";
import { loadPyodide } from "pyodide";
import { describe, expect, it } from "vitest";
import pythonAdvanced from "../../fixtures/challenges/python-advanced";
import { createPythonHandler } from "@/runtimes/python/handler";
import { recordingContext } from "../helpers/handler-context";
import { describeRuntimeContract } from "./contract";

// Real CPython (Pyodide) running in Node — the same WebAssembly build the browser worker loads.
const indexURL = `${dirname(createRequire(import.meta.url).resolve("pyodide/package.json"))}/`;
const handler = createPythonHandler(() => loadPyodide({ indexURL }));

describeRuntimeContract(
  "Python",
  handler,
  {
    hello: `print("hello")`,
    stderr: `import sys\nprint("oops", file=sys.stderr)`,
    compileError: `def broken(:\n    pass`,
    runtimeError: `x = {}\nx["missing"]`,
  },
  [pythonAdvanced],
);

describe("Python runtime specifics", () => {
  it("reports syntax errors with a line number", async () => {
    const outcome = await handler.execute({ source: `a = 1\nb = (\n` }, recordingContext());
    expect(outcome.status).toBe("compile-error");
    expect(outcome.diagnostics[0]?.line).toBeGreaterThanOrEqual(2);
  });

  it("shows only user frames in tracebacks", async () => {
    const ctx = recordingContext();
    await handler.execute({ source: `def f():\n    raise ValueError("bad input")\nf()` }, ctx);
    expect(ctx.stderrText).toContain('File "/work/solution.py", line 2');
    expect(ctx.stderrText).toContain("ValueError: bad input");
    expect(ctx.stderrText).not.toContain("__ccl_harness__");
  });

  it("runs __main__ blocks and reads stdin", async () => {
    const ctx = recordingContext();
    await handler.execute(
      { source: `if __name__ == "__main__":\n    print(input().upper())`, stdin: "shout" },
      ctx,
    );
    expect(ctx.stdoutText).toBe("SHOUT\n");
  });

  it("explains bare assertion failures with operand values", async () => {
    const ctx = recordingContext();
    await handler.runTests(
      {
        source: `def add(a, b):\n    return a - b`,
        prelude: `from solution import add`,
        cases: [{ id: "adds", code: `result = add(2, 3)\nassert result == 5` }],
      },
      ctx,
    );
    expect(ctx.tests[0]?.status).toBe("fail");
    expect(ctx.tests[0]?.message).toContain("assert result == 5");
    expect(ctx.tests[0]?.message).toContain("left:  -1");
  });

  it("isolates module state between tests", async () => {
    const ctx = recordingContext();
    await handler.runTests(
      {
        source: `count = 0\ndef bump():\n    global count\n    count += 1\n    return count`,
        prelude: `from solution import bump`,
        cases: [
          { id: "one", code: `assert bump() == 1` },
          { id: "two", code: `assert bump() == 1` },
        ],
      },
      ctx,
    );
    expect(ctx.tests.map((t) => t.status)).toEqual(["pass", "pass"]);
  });

  it("keeps user output separate from test results", async () => {
    const ctx = recordingContext();
    await handler.runTests(
      {
        source: `def f():\n    print("debug line")\n    return 1`,
        prelude: `from solution import f`,
        cases: [{ id: "a", code: `assert f() == 1` }],
      },
      ctx,
    );
    expect(ctx.stdoutText).toBe("debug line\n");
    expect(ctx.tests).toHaveLength(1);
  });

  it("cannot forge test results by printing protocol-looking lines", async () => {
    const ctx = recordingContext();
    await handler.runTests(
      {
        source: `print("\\x1eCCL:guess:" + '{"id": "a", "status": "pass"}')\ndef f():\n    return 0`,
        prelude: `from solution import f`,
        cases: [{ id: "a", code: `assert f() == 1` }],
      },
      ctx,
    );
    expect(ctx.tests.map((t) => t.status)).toEqual(["fail"]);
  });

  it("blocks the js bridge module", async () => {
    const ctx = recordingContext();
    const outcome = await handler.execute({ source: `import js` }, ctx);
    expect(outcome.status).toBe("runtime-error");
    expect(ctx.stderrText).toContain("not available");
  });

  it("treats sys.exit(0) as success and sys.exit(2) as failure", async () => {
    expect(
      (await handler.execute({ source: `import sys\nsys.exit(0)` }, recordingContext())).status,
    ).toBe("success");
    expect(
      (await handler.execute({ source: `import sys\nsys.exit(2)` }, recordingContext())).status,
    ).toBe("runtime-error");
  });
});
