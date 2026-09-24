import { describe, expect, it } from "vitest";
import cAdvanced from "../../fixtures/challenges/c-advanced";
import cppExpert from "../../fixtures/challenges/cpp-expert";
import {
  buildTestSource,
  createClangHandler,
  hasMainFunction,
  parseClangDiagnostics,
  type ClangToolchain,
} from "@/runtimes/clang/handler";
import { recordingContext } from "../helpers/handler-context";
import { describeRuntimeContract } from "./contract";

// The same WebAssembly build of clang/LLVM 22 the browser worker self-hosts.
const load = () => import("@yowasp/clang") as unknown as Promise<ClangToolchain>;
const c = createClangHandler("c", load);
const cpp = createClangHandler("cpp", load);

describeRuntimeContract(
  "C",
  c,
  {
    hello: `#include <stdio.h>\nint main(void) { printf("hello\\n"); return 0; }`,
    stderr: `#include <stdio.h>\nint main(void) { fprintf(stderr, "oops\\n"); return 0; }`,
    compileError: `int main(void) { return undefined_symbol; }`,
    runtimeError: `#include <stdlib.h>\n#include <stdio.h>\nint main(void) { fprintf(stderr, "about to abort\\n"); abort(); }`,
  },
  [cAdvanced],
);

describeRuntimeContract(
  "C++",
  cpp,
  {
    hello: `#include <iostream>\nint main() { std::cout << "hello" << std::endl; }`,
    stderr: `#include <iostream>\nint main() { std::cerr << "oops" << std::endl; }`,
    compileError: `int main() { std::vector<int> v; }`,
    runtimeError: `#include <cstdio>\nint main() { std::fprintf(stderr, "exiting\\n"); return 3; }`,
  },
  [cppExpert],
);

describe("C/C++ runtime specifics", () => {
  it("maps compiler errors to diagnostics on the user's lines", async () => {
    const outcome = await c.execute(
      { source: `int main(void) {\n  int x = ;\n  return 0;\n}` },
      recordingContext(),
    );
    expect(outcome.status).toBe("compile-error");
    expect(outcome.diagnostics[0]).toMatchObject({ severity: "error", line: 2 });
  });

  it("requires main() to run but not for tests", async () => {
    const outcome = await c.execute(
      { source: `int add(int a, int b) { return a + b; }` },
      recordingContext(),
    );
    expect(outcome.status).toBe("compile-error");
    expect(outcome.message).toContain("main");
    const ctx = recordingContext();
    await c.runTests(
      {
        source: `int add(int a, int b) { return a + b; }`,
        prelude: ``,
        cases: [{ id: "adds", code: `CHECK_EQ_INT(add(2, 3), 5);` }],
      },
      ctx,
    );
    expect(ctx.tests[0]?.status).toBe("pass");
  });

  it("lets solutions keep their own main() when tested", async () => {
    const ctx = recordingContext();
    await c.runTests(
      {
        source: `#include <stdio.h>\nint twice(int x) { return 2 * x; }\nint main(void) { printf("%d\\n", twice(21)); return 0; }`,
        prelude: ``,
        cases: [{ id: "t", code: `CHECK_EQ_INT(twice(4), 8);` }],
      },
      ctx,
    );
    expect(ctx.tests[0]?.status).toBe("pass");
  });

  it("isolates tests: fresh memory per test, and a crash fails only that test", async () => {
    const ctx = recordingContext();
    await c.runTests(
      {
        source: `static int counter = 0;\nint bump(void) { return ++counter; }\nvoid crash(void) { __builtin_trap(); }`,
        prelude: ``,
        cases: [
          { id: "first", code: `CHECK_EQ_INT(bump(), 1);` },
          { id: "crashes", code: `crash();` },
          { id: "second", code: `CHECK_EQ_INT(bump(), 1);` },
        ],
      },
      ctx,
    );
    expect(ctx.tests.map((t) => t.status)).toEqual(["pass", "error", "pass"]);
    expect(ctx.tests[1]?.message).toContain("Crashed");
  });

  it("reports check failures with values and test-relative line numbers", async () => {
    const ctx = recordingContext();
    await cpp.runTests(
      {
        source: `int add(int a, int b) { return a - b; }`,
        prelude: ``,
        cases: [{ id: "adds", code: `int r = add(2, 3);\nCHECK_EQ(r, 5);` }],
      },
      ctx,
    );
    expect(ctx.tests[0]).toMatchObject({ status: "fail" });
    expect(ctx.tests[0]?.message).toBe("line 2: CHECK_EQ(r, 5): -1 != 5");
  });

  it("rejects C++ exceptions at compile time", async () => {
    const outcome = await cpp.execute(
      { source: `int main() { try { throw 1; } catch (...) {} }` },
      recordingContext(),
    );
    expect(outcome.status).toBe("compile-error");
  });

  it("parses clang diagnostics", () => {
    expect(
      parseClangDiagnostics(
        "solution.c:3:7: warning: unused variable 'x'\ntests.c:1:1: error: nope",
        "solution.c",
      ),
    ).toEqual([{ severity: "warning", message: "unused variable 'x'", line: 3, column: 7 }]);
  });

  it("detects main() while ignoring comments", () => {
    expect(hasMainFunction("int main(void) {}")).toBe(true);
    expect(hasMainFunction("// int main(void) {}\nint helper(void);")).toBe(false);
  });

  it("generates one dispatchable function per test", () => {
    const source = buildTestSource("c", "", [
      { id: "a", code: "CHECK(1);" },
      { id: "b", code: "CHECK(1);" },
    ]);
    expect(source).toContain('#line 1 "test:a"');
    expect(source).toContain("case 1: ccl_test_1(); break;");
    expect(source).toContain("#define main ccl_user_main");
  });
});
