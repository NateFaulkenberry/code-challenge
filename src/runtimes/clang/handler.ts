import { ConsoleStdout, File, OpenFile, WASI } from "@bjorn3/browser_wasi_shim";
import type { Diagnostic } from "@/domain/execution";
import type { HandlerContext, RawOutcome, RuntimeHandler, TestCaseSource } from "../core/types";
import { createNonce, ProtocolStream } from "../core/test-protocol";
import harnessHeader from "./ccl_test.h?raw";

/** The subset of @yowasp/clang's API we use (it is loaded dynamically). */
export interface ClangToolchain {
  commands: Record<
    "clang" | "clang++",
    (
      args: string[],
      files: Record<string, string | Uint8Array>,
      options: ClangRunOptions,
    ) => Promise<Record<string, unknown> | undefined>
  >;
  Exit: new (...args: never[]) => Error & { code: number };
}

interface ClangRunOptions {
  stdout?: (bytes: Uint8Array | null) => void;
  stderr?: (bytes: Uint8Array | null) => void;
  fetchProgress?: (event: { totalLength: number; doneLength: number }) => void;
}

export type ClangLanguage = "c" | "cpp";

const CONFIG: Record<
  ClangLanguage,
  { driver: "clang" | "clang++"; solution: string; tests: string; flags: string[] }
> = {
  c: { driver: "clang", solution: "solution.c", tests: "tests.c", flags: ["-std=c17"] },
  cpp: {
    driver: "clang++",
    solution: "solution.cpp",
    tests: "tests.cpp",
    flags: ["-std=c++20", "-fno-exceptions"],
  },
};

const COMMON_FLAGS = [
  "-O1",
  "-Wall",
  "-Wextra",
  "-Wno-unused-parameter",
  "-Wl,-z,stack-size=1048576",
];

/** "solution.c:3:5: error: message" → diagnostics for the user's file. */
export function parseClangDiagnostics(stderr: string, fileName: string): Diagnostic[] {
  const pattern = new RegExp(
    `^${fileName.replace(".", "\\.")}:(\\d+):(\\d+): (error|warning|fatal error): (.*)$`,
    "gm",
  );
  return [...stderr.matchAll(pattern)].map((m) => ({
    severity: m[3] === "warning" ? ("warning" as const) : ("error" as const),
    message: m[4] ?? "",
    line: Number(m[1]),
    column: Number(m[2]),
  }));
}

export function hasMainFunction(source: string): boolean {
  return /\bint\s+main\s*\(/.test(source.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ""));
}

export function buildTestSource(
  language: ClangLanguage,
  prelude: string,
  cases: readonly TestCaseSource[],
): string {
  const { solution } = CONFIG[language];
  const tests = cases
    .map(
      (testCase, index) =>
        `static void ccl_test_${index}(void) {\n#line 1 "test:${testCase.id}"\n${testCase.code}\n}\n`,
    )
    .join("\n");
  const dispatch = cases
    .map((_, index) => `    case ${index}: ccl_test_${index}(); break;`)
    .join("\n");
  return `#include "ccl_test.h"
#define main ccl_user_main
#include "${solution}"
#undef main
#line 1 "prelude"
${prelude}
${tests}
int main(int argc, char **argv) {
  if (argc < 4) return 2;
  switch (atoi(argv[1])) {
${dispatch}
    default: return 2;
  }
  ccl_report(argv[2], argv[3]);
  return 0;
}
`;
}

interface ProgramRun {
  exitCode: number | null;
  trap?: string;
}

/**
 * Compiles with clang (WebAssembly build of LLVM) and runs the resulting
 * wasm32-wasip1 module on a WASI shim. Host-agnostic: the worker loads the
 * self-hosted toolchain; tests import it from node_modules.
 */
export function createClangHandler(
  language: ClangLanguage,
  loadToolchain: () => Promise<ClangToolchain>,
): RuntimeHandler {
  const config = CONFIG[language];
  const decoder = new TextDecoder();
  let toolchain: ClangToolchain | undefined;
  let progress: HandlerContext["progress"] | undefined;

  async function compile(
    files: Record<string, string>,
    entry: string,
  ): Promise<{ module?: WebAssembly.Module; stderr: string }> {
    if (!toolchain) throw new Error("The C/C++ toolchain is not initialized.");
    let stderr = "";
    const collect = (bytes: Uint8Array | null) => {
      if (bytes) stderr += decoder.decode(bytes, { stream: true });
    };
    try {
      const output = await toolchain.commands[config.driver](
        [...config.flags, ...COMMON_FLAGS, entry, "-o", "program.wasm"],
        files,
        {
          stdout: collect,
          stderr: collect,
          fetchProgress: ({ doneLength, totalLength }) =>
            progress?.(
              "downloading",
              `C/C++ toolchain ${Math.round((doneLength / Math.max(totalLength, 1)) * 100)}%`,
            ),
        },
      );
      const binary = output?.["program.wasm"];
      if (!(binary instanceof Uint8Array))
        return { stderr: `${stderr}\nThe compiler produced no output.` };
      return { module: await WebAssembly.compile(binary as Uint8Array<ArrayBuffer>), stderr };
    } catch (error) {
      if (error instanceof toolchain.Exit) return { stderr };
      throw error;
    }
  }

  function run(
    module: WebAssembly.Module,
    args: string[],
    stdin: string,
    onStdout: (line: string) => void,
    onStderr: (line: string) => void,
  ): ProgramRun {
    const wasi = new WASI(
      args,
      [],
      [
        new OpenFile(new File(new TextEncoder().encode(stdin))),
        ConsoleStdout.lineBuffered(onStdout),
        ConsoleStdout.lineBuffered(onStderr),
      ],
      { debug: false },
    );
    try {
      const instance = new WebAssembly.Instance(module, {
        wasi_snapshot_preview1: wasi.wasiImport,
      });
      return { exitCode: wasi.start(instance as unknown as Parameters<WASI["start"]>[0]) };
    } catch (error) {
      return { exitCode: null, trap: error instanceof Error ? error.message : String(error) };
    }
  }

  function compileFailure(
    stderr: string,
    ctx: HandlerContext,
    fileName = config.solution,
  ): RawOutcome {
    ctx.stderr(stderr);
    const diagnostics = parseClangDiagnostics(stderr, fileName);
    const first = diagnostics.find((d) => d.severity === "error");
    return {
      status: "compile-error",
      exitCode: 1,
      diagnostics,
      message: first ? `${first.message} (line ${first.line})` : "Compilation failed.",
    };
  }

  return {
    async init(ctx) {
      progress = ctx.progress;
      ctx.progress("downloading", "C/C++ toolchain");
      toolchain = await loadToolchain();
      // Warm up: the first compile fetches and instantiates LLVM (~100 MB, cached afterwards).
      ctx.progress("initializing", "Starting clang");
      await compile({ "warmup.c": "int main(void) { return 0; }" }, "warmup.c");
    },

    async execute(request, ctx) {
      if (!hasMainFunction(request.source)) {
        const message =
          "Running a program requires an `int main()` function. Tests don't need one.";
        ctx.stderr(`${message}\n`);
        return { status: "compile-error", exitCode: null, diagnostics: [], message };
      }
      const { module, stderr } = await compile(
        { [config.solution]: request.source },
        config.solution,
      );
      if (!module) return compileFailure(stderr, ctx);
      if (stderr.trim()) ctx.stderr(stderr); // warnings
      const result = run(
        module,
        ["program"],
        request.stdin ?? "",
        (line) => ctx.stdout(`${line}\n`),
        (line) => ctx.stderr(`${line}\n`),
      );
      if (result.trap) {
        ctx.stderr(`Program crashed: ${result.trap}\n`);
        return {
          status: "runtime-error",
          exitCode: null,
          diagnostics: [],
          message: `The program crashed (${result.trap}).`,
        };
      }
      return result.exitCode === 0
        ? { status: "success", exitCode: 0, diagnostics: [] }
        : {
            status: "runtime-error",
            exitCode: result.exitCode,
            diagnostics: [],
            message: `The program exited with code ${result.exitCode}.`,
          };
    },

    async runTests(request, ctx) {
      const files = {
        "ccl_test.h": harnessHeader,
        [config.solution]: request.source,
        [config.tests]: buildTestSource(language, request.prelude, request.cases),
      };
      const { module, stderr } = await compile(files, config.tests);
      if (!module) {
        const userErrors = parseClangDiagnostics(stderr, config.solution);
        return compileFailure(stderr, ctx, userErrors.length ? config.solution : config.tests);
      }

      for (const [index, testCase] of request.cases.entries()) {
        const nonce = createNonce();
        const state = { reported: false };
        const stream = new ProtocolStream(nonce, ctx.stdout, (result) => {
          state.reported = true;
          ctx.reportTest(result);
        });
        ctx.startTest(testCase.id);
        const result = run(
          module,
          ["tests", String(index), nonce, testCase.id],
          "",
          (line) => stream.push(`${line}\n`),
          (line) => ctx.stderr(`${line}\n`),
        );
        stream.flush();
        if (!state.reported) {
          ctx.reportTest({
            id: testCase.id,
            status: "error",
            message: result.trap
              ? `Crashed: ${result.trap}`
              : `The test ended early (exit code ${result.exitCode ?? "?"}).`,
          });
        }
      }
      return { status: "success", exitCode: 0, diagnostics: [] };
    },
  };
}
