import { getPHPLoaderModule } from "@php-wasm/node-8-4";
import { loadPHPRuntime, PHP, setPhpIniEntries } from "@php-wasm/universal";
import { describe, expect, it } from "vitest";
import phpIntermediate from "../../fixtures/challenges/php-intermediate";
import { createPhpHandler, parseErrorDiagnostic, PHP_INI } from "@/runtimes/php/handler";
import { recordingContext } from "../helpers/handler-context";
import { describeRuntimeContract } from "./contract";

// The Node build of the same PHP 8.4 WebAssembly binary the browser worker uses.
const handler = createPhpHandler(async () => {
  const php = new PHP(await loadPHPRuntime(await getPHPLoaderModule()));
  await setPhpIniEntries(php, PHP_INI);
  return php;
});

describeRuntimeContract(
  "PHP",
  handler,
  {
    hello: `<?php echo "hello\\n";`,
    stderr: `<?php fwrite(fopen('php://stderr', 'w'), "oops\\n");`,
    compileError: `<?php function broken( {`,
    runtimeError: `<?php throw new RuntimeException("failed");`,
  },
  [phpIntermediate],
);

describe("PHP runtime specifics", () => {
  it("reports parse errors with a line number", async () => {
    const outcome = await handler.execute(
      { source: `<?php\n$a = 1;\n$b = ;\n` },
      recordingContext(),
    );
    expect(outcome.status).toBe("compile-error");
    expect(outcome.diagnostics[0]?.line).toBe(3);
  });

  it("keeps warnings on stderr without failing the run", async () => {
    const ctx = recordingContext();
    const outcome = await handler.execute({ source: `<?php echo $undefined; echo "done";` }, ctx);
    expect(outcome.status).toBe("success");
    expect(ctx.stdoutText).toBe("done");
    expect(ctx.stderrText).toContain("Undefined variable $undefined");
  });

  it("never emits HTML error markup", async () => {
    const ctx = recordingContext();
    await handler.execute({ source: `<?php undefined_function();` }, ctx);
    expect(ctx.stdoutText).not.toContain("<b>");
    expect(ctx.stderrText).toContain("Call to undefined function undefined_function()");
  });

  it("isolates each test in its own request", async () => {
    const ctx = recordingContext();
    await handler.runTests(
      {
        source: `<?php\nfunction bump(): int { static $n = 0; return ++$n; }`,
        prelude: ``,
        cases: [
          { id: "one", code: `assert_same(1, bump());` },
          { id: "two", code: `assert_same(1, bump());` },
        ],
      },
      ctx,
    );
    expect(ctx.tests.map((t) => t.status)).toEqual(["pass", "pass"]);
  });

  it("distinguishes assertion failures from errors and explains values", async () => {
    const ctx = recordingContext();
    await handler.runTests(
      {
        source: `<?php\nfunction add(int $a, int $b): int { return $a - $b; }`,
        prelude: ``,
        cases: [
          { id: "fails", code: `assert_same(5, add(2, 3));` },
          { id: "errors", code: `add("x", 1);` },
        ],
      },
      ctx,
    );
    expect(ctx.tests.map((t) => t.status)).toEqual(["fail", "error"]);
    expect(ctx.tests[0]?.message).toContain("Expected (===) 5, got -1");
    expect(ctx.tests[1]?.message).toContain("TypeError");
  });

  it("reports a test that calls exit() as an error rather than hanging or passing", async () => {
    const ctx = recordingContext();
    await handler.runTests(
      {
        source: `<?php function f() { exit(0); }`,
        prelude: ``,
        cases: [{ id: "exits", code: `f();` }],
      },
      ctx,
    );
    expect(ctx.tests[0]?.status).toBe("error");
  });

  it("parses PHP parse-error lines", () => {
    expect(
      parseErrorDiagnostic(
        "PHP Parse error:  syntax error, unexpected ';' in /work/solution.php on line 7",
      ),
    ).toEqual({
      severity: "error",
      message: "Parse error: syntax error, unexpected ';'",
      line: 7,
    });
  });
});
