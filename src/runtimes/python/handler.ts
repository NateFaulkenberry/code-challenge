import type { PyodideInterface } from "pyodide";
import type { Diagnostic } from "@/domain/execution";
import type { HandlerContext, RawOutcome, RuntimeHandler } from "../core/types";
import { createNonce, ProtocolStream } from "../core/test-protocol";
import harnessSource from "./harness.py?raw";

const WORK_DIR = "/work";
const SOLUTION = `${WORK_DIR}/solution.py`;

/** The slice of Pyodide's Emscripten FS we use (its bundled typings don't resolve it). */
interface PyodideFs {
  mkdirTree(path: string): void;
  writeFile(path: string, data: string): void;
}

const fsOf = (py: PyodideInterface) => py.FS as PyodideFs;

/** Modules user code must not reach: they bridge into the JS realm. */
const BLOCKED_MODULES = ["js", "pyodide_js"];

interface PythonErrorInfo {
  kind: "syntax" | "runtime";
  message: string;
  line?: number;
}

/**
 * Host-agnostic Python handler: the worker passes a browser Pyodide loader,
 * tests pass a Node one. All Python-side logic lives in harness.py.
 */
export function createPythonHandler(loadRuntime: () => Promise<PyodideInterface>): RuntimeHandler {
  let pyodide: PyodideInterface | undefined;
  // Output is routed to whichever request is active.
  let sink: { out: (line: string) => void; err: (line: string) => void } | undefined;

  async function init(ctx: HandlerContext): Promise<void> {
    ctx.progress("downloading", "Python (Pyodide)");
    const py = await loadRuntime();
    ctx.progress("initializing");
    py.setStdout({ batched: (line) => sink?.out(`${line}\n`) });
    py.setStderr({ batched: (line) => sink?.err(`${line}\n`) });
    fsOf(py).mkdirTree(WORK_DIR);
    fsOf(py).writeFile(`${WORK_DIR}/__ccl_harness__.py`, harnessSource);
    await py.runPythonAsync(`
import sys
sys.path.insert(0, "${WORK_DIR}")
import __ccl_harness__
class __CclBlocker:
    def find_spec(self, name, path=None, target=None):
        if name.split(".")[0] in ${JSON.stringify(BLOCKED_MODULES)}:
            raise ImportError(f"The '{name}' module is not available in this environment.")
        return None
sys.meta_path.insert(0, __CclBlocker())
for _m in ${JSON.stringify(BLOCKED_MODULES)}:
    sys.modules.pop(_m, None)
`);
    pyodide = py;
  }

  function withStdin(stdin: string | undefined): void {
    if (!pyodide) return;
    const lines = (stdin ?? "").split("\n");
    let index = 0;
    pyodide.setStdin({ stdin: () => (index < lines.length ? lines[index++] : undefined) });
  }

  /** Runs Python, converting Python exceptions into structured info (never throws for user errors). */
  async function runGuarded(code: string): Promise<PythonErrorInfo | undefined> {
    if (!pyodide) throw new Error("Python runtime is not initialized.");
    const result = (await pyodide.runPythonAsync(`
import json, __ccl_harness__ as h
try:
    ${code}
    __ccl_result = None
except SyntaxError as e:
    __ccl_result = json.dumps({"kind": "syntax", "message": f"{type(e).__name__}: {e.msg}", "line": e.lineno if e.filename == h.SOLUTION else None})
except BaseException as e:
    if isinstance(e, SystemExit) and (e.code is None or e.code == 0):
        __ccl_result = None
    else:
        __ccl_result = json.dumps({"kind": "runtime", "message": h.format_exception(e)})
__ccl_result
`)) as string | undefined;
    return result ? (JSON.parse(result) as PythonErrorInfo) : undefined;
  }

  function toOutcome(error: PythonErrorInfo | undefined, ctx: HandlerContext): RawOutcome {
    if (!error) return { status: "success", exitCode: 0, diagnostics: [] };
    ctx.stderr(`${error.message}\n`);
    if (error.kind === "syntax") {
      const diagnostic: Diagnostic = {
        severity: "error",
        message: error.message,
        ...(error.line ? { line: error.line } : {}),
      };
      return {
        status: "compile-error",
        exitCode: 1,
        diagnostics: [diagnostic],
        message: error.message,
      };
    }
    return {
      status: "runtime-error",
      exitCode: 1,
      diagnostics: [],
      message: "The program raised an exception.",
    };
  }

  return {
    init,
    async execute(request, ctx) {
      if (!pyodide) throw new Error("Python runtime is not initialized.");
      fsOf(pyodide).writeFile(SOLUTION, request.source);
      withStdin(request.stdin);
      sink = { out: ctx.stdout, err: ctx.stderr };
      try {
        return toOutcome(await runGuarded("h.run_program()"), ctx);
      } finally {
        sink = undefined;
      }
    },
    async runTests(request, ctx) {
      if (!pyodide) throw new Error("Python runtime is not initialized.");
      // Syntax errors in the solution are compile errors, not per-test failures.
      fsOf(pyodide).writeFile(SOLUTION, request.source);
      const syntax = await runGuarded(`compile(open(h.SOLUTION).read(), h.SOLUTION, "exec")`);
      if (syntax) return toOutcome(syntax, ctx);

      const nonce = createNonce();
      const stream = new ProtocolStream(nonce, ctx.stdout, (result) => ctx.reportTest(result));
      sink = { out: (text) => stream.push(text), err: ctx.stderr };
      withStdin("");
      const spec = JSON.stringify({ prelude: request.prelude, cases: request.cases });
      (pyodide.globals as unknown as { set(name: string, value: unknown): void }).set(
        "__ccl_spec",
        spec,
      );
      try {
        const failure = await runGuarded(`h.run_tests(${JSON.stringify(nonce)}, __ccl_spec)`);
        stream.flush();
        if (failure) {
          return {
            status: "internal-error",
            exitCode: null,
            diagnostics: [],
            message: `The test harness failed — the challenge definition may be invalid. ${failure.message}`,
          };
        }
        return { status: "success", exitCode: 0, diagnostics: [] };
      } finally {
        sink = undefined;
      }
    },
  };
}
