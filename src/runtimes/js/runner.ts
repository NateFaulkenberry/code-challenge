import type { Diagnostic } from "@/domain/execution";
import { formatValue } from "../core/output";
import type { HandlerContext, RawOutcome, TestCaseSource } from "../core/types";
import { AssertionError, expect, fn, sleep } from "./expect";
import { createLoopGuard, instrumentLoops } from "./loop-guard";
import { createRequire, evaluateModule, FUNCTION_HEADER_LINES, type RequireFn } from "./module";
import { createTrackedTimers } from "./timers";
import { TranspileError, transpile } from "./transpile";
import { onUnhandledRejection } from "./unhandled";

export const DEFAULT_TEST_TIMEOUT_MS = 2_000;

export interface JsRunnerConfig {
  solutionFile: string;
  jsx: boolean;
  /** Extra modules user code may import (e.g. react). */
  modules: Readonly<Record<string, () => unknown>>;
  /** Called before each test (e.g. React cleanup). */
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
  testTimeoutMs?: number;
  /** Maximum time any single loop may run before it throws (see loop-guard). */
  loopBudgetMs?: number;
}

export const DEFAULT_LOOP_BUDGET_MS = 5_000;

/** Transpiles and instruments user code; acorn doubles as a stricter syntax check. */
function prepare(source: string, fileName: string, config: JsRunnerConfig): string {
  const code = transpile(source, { fileName, jsx: config.jsx });
  try {
    return instrumentLoops(code);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const loc = (error as { loc?: { line: number; column: number } }).loc;
    throw new TranspileError(message, {
      severity: "error",
      message: message.replace(/\s*\(\d+:\d+\)\s*$/, ""),
      ...(loc ? { line: loc.line, column: loc.column + 1 } : {}),
    });
  }
}

function guardBindings(config: JsRunnerConfig): Record<string, unknown> {
  return createLoopGuard(config.loopBudgetMs ?? DEFAULT_LOOP_BUDGET_MS).bindings;
}

function createConsole(ctx: HandlerContext) {
  const line = (values: unknown[]) => `${values.map((v) => formatValue(v)).join(" ")}\n`;
  const out = (...values: unknown[]) => ctx.stdout(line(values));
  const err = (...values: unknown[]) => ctx.stderr(line(values));
  return { log: out, info: out, debug: out, warn: err, error: err, table: out, dir: out };
}

export function describeError(error: unknown, fileName?: string): string {
  if (error instanceof AssertionError) return error.message;
  if (error instanceof Error) {
    const frames = (error.stack ?? "")
      .split("\n")
      .filter((l) => fileName && l.includes(fileName))
      .slice(0, 3)
      .map((l) => `    ${mapStackLine(l.trim(), fileName ?? "")}`);
    return [`${error.name}: ${error.message}`, ...frames].join("\n");
  }
  return `Thrown value: ${formatValue(error)}`;
}

/** Rewrites `file:line:col` in a stack frame to the user's own line numbers. */
export function mapStackLine(line: string, fileName: string): string {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return line.replace(
    new RegExp(`${escaped}:(\\d+):(\\d+)`),
    (_match, row: string, column: string) => {
      const userLine = Math.max(1, Number(row) - FUNCTION_HEADER_LINES);
      return `${fileName}:${userLine}:${column}`;
    },
  );
}

function compileFailure(error: unknown, label: string): RawOutcome {
  const diagnostics: Diagnostic[] = error instanceof TranspileError ? [error.diagnostic] : [];
  return {
    status: "compile-error",
    exitCode: null,
    diagnostics,
    message: `${label}: ${error instanceof Error ? error.message : String(error)}`,
  };
}

/**
 * Compiles and evaluates the solution module once, returning its exports.
 * Used by runtimes that do something other than "run to completion" with the
 * module (e.g. React renders its default export as a live preview).
 */
export function loadSolutionModule(
  source: string,
  config: JsRunnerConfig,
  ctx: HandlerContext,
): { ok: true; exports: Record<string, unknown> } | { ok: false; outcome: RawOutcome } {
  let code: string;
  try {
    code = prepare(source, config.solutionFile, config);
  } catch (error) {
    return { ok: false, outcome: compileFailure(error, "Syntax error") };
  }
  try {
    const exports = evaluateModule(code, config.solutionFile, createRequire(config.modules), {
      console: createConsole(ctx),
      ...guardBindings(config),
    });
    return { ok: true, exports };
  } catch (error) {
    ctx.stderr(`${describeError(error, config.solutionFile)}\n`);
    return {
      ok: false,
      outcome: {
        status: "runtime-error",
        exitCode: 1,
        diagnostics: [],
        message: "The module threw while loading.",
      },
    };
  }
}

/** Runs a program top to bottom, then waits for pending timers to drain. */
export async function runJsProgram(
  source: string,
  config: JsRunnerConfig,
  ctx: HandlerContext,
): Promise<RawOutcome> {
  let code: string;
  try {
    code = prepare(source, config.solutionFile, config);
  } catch (error) {
    return compileFailure(error, "Syntax error");
  }
  const timers = createTrackedTimers();
  const console = createConsole(ctx);
  let asyncError: unknown;
  const unsubscribe = onUnhandledRejection((reason) => {
    asyncError ??= reason;
  });
  try {
    evaluateModule(code, config.solutionFile, createRequire(config.modules), {
      console,
      ...timers.bindings,
      ...guardBindings(config),
    });
    await timers.idle();
    // Give rejected promises without handlers a turn to surface.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- rethrowing whatever user code rejected with
    if (asyncError !== undefined) throw asyncError;
    return { status: "success", exitCode: 0, diagnostics: [] };
  } catch (error) {
    ctx.stderr(`${describeError(error, config.solutionFile)}\n`);
    return {
      status: "runtime-error",
      exitCode: 1,
      diagnostics: [],
      message: "The program threw an uncaught error.",
    };
  } finally {
    timers.clearAll();
    unsubscribe();
  }
}

/**
 * Each test is an independent module: `prelude` + an async function wrapping
 * the test body. The solution is re-evaluated per test so module-level state
 * can't leak between cases.
 */
export async function runJsTests(
  request: { source: string; prelude: string; cases: readonly TestCaseSource[] },
  config: JsRunnerConfig,
  ctx: HandlerContext,
): Promise<RawOutcome> {
  let solutionCode: string;
  try {
    solutionCode = prepare(request.source, config.solutionFile, config);
  } catch (error) {
    return compileFailure(error, "Syntax error");
  }

  // A rejection nobody awaited belongs to the user's code, not the host.
  const unsubscribe = onUnhandledRejection((reason) => {
    ctx.stderr(`Unhandled promise rejection: ${describeError(reason, config.solutionFile)}\n`);
  });
  try {
    return await runCases(request, solutionCode, config, ctx);
  } finally {
    // Let late rejections from the final test surface while we're still listening.
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe();
  }
}

async function runCases(
  request: { prelude: string; cases: readonly TestCaseSource[] },
  solutionCode: string,
  config: JsRunnerConfig,
  ctx: HandlerContext,
): Promise<RawOutcome> {
  const console = createConsole(ctx);
  const testFile = "tests.tsx";
  const baseName = config.solutionFile.replace(/\.[^.]+$/, "");

  for (const testCase of request.cases) {
    let testCode: string;
    try {
      testCode = prepare(
        `${request.prelude}\nexport default async function __ccl_test() {\n${testCase.code}\n}\n`,
        testFile,
        config,
      );
    } catch (error) {
      return {
        status: "internal-error",
        exitCode: null,
        diagnostics: [],
        message: `The test "${testCase.id}" could not be compiled — the challenge definition is invalid. ${error instanceof Error ? error.message : ""}`,
      };
    }

    ctx.startTest(testCase.id);
    const started = performance.now();
    const timers = createTrackedTimers();
    try {
      await config.beforeEach?.();
      const bindings = { console, ...timers.bindings, ...guardBindings(config) };
      const solutionRequire: RequireFn = createRequire(config.modules);
      const require = createRequire({
        ...config.modules,
        [`./${baseName}`]: () =>
          evaluateModule(solutionCode, config.solutionFile, solutionRequire, bindings),
      });
      const testModule = evaluateModule(testCode, testFile, require, {
        ...bindings,
        expect,
        fn,
        sleep,
      });
      const body = testModule.default as () => Promise<void>;
      await withTimeout(body(), config.testTimeoutMs ?? DEFAULT_TEST_TIMEOUT_MS);
      ctx.reportTest({ id: testCase.id, status: "pass", durationMs: performance.now() - started });
    } catch (error) {
      ctx.reportTest({
        id: testCase.id,
        status:
          error instanceof AssertionError
            ? "fail"
            : error instanceof TestTimeoutError
              ? "timeout"
              : "error",
        message: describeError(error, config.solutionFile).slice(0, 2_000),
        durationMs: performance.now() - started,
      });
    } finally {
      timers.clearAll();
      try {
        await config.afterEach?.();
      } catch {
        // Cleanup failures must not mask the test result.
      }
    }
  }
  return { status: "success", exitCode: 0, diagnostics: [] };
}

class TestTimeoutError extends Error {
  constructor(ms: number) {
    super(`Test did not finish within ${ms}ms (is a promise never resolved?).`);
    this.name = "TestTimeoutError";
  }
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TestTimeoutError(ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
