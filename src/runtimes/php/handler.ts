import type { PHP, PHPResponse } from "@php-wasm/universal";
import type { Diagnostic } from "@/domain/execution";
import type { HandlerContext, RawOutcome, RuntimeHandler } from "../core/types";
import { createNonce, scanProtocolOutput } from "../core/test-protocol";
import harnessSource from "./harness.php?raw";

const WORK_DIR = "/work";
const SOLUTION = `${WORK_DIR}/solution.php`;
const HARNESS = `${WORK_DIR}/__ccl_harness.php`;
const TEST_FILE = `${WORK_DIR}/__ccl_test.php`;

/** Settings applied at startup: clean text errors on stderr, never HTML on stdout. */
export const PHP_INI = {
  display_errors: "0",
  html_errors: "0",
  log_errors: "1",
  error_reporting: String(32767), // E_ALL
  memory_limit: "256M",
} as const;

interface PhpLike {
  mkdir(path: string): void;
  writeFile(path: string, data: string): void;
  run(options: { scriptPath?: string; code?: string }): Promise<PHPResponse>;
}

/** php-wasm throws on non-zero exit codes; the response is still what we want. */
async function runPhp(
  php: PhpLike,
  options: { scriptPath?: string; code?: string },
): Promise<PHPResponse> {
  try {
    return await php.run(options);
  } catch (error) {
    const response = (error as { response?: PHPResponse }).response;
    if (response) return response;
    throw error;
  }
}

/** "PHP Parse error:  Unclosed '(' in /work/solution.php on line 3" → diagnostic. */
export function parseErrorDiagnostic(errors: string): Diagnostic | undefined {
  const match = /PHP Parse error:\s+(.*?) in \S*solution\.php on line (\d+)/.exec(errors);
  if (!match) return undefined;
  return { severity: "error", message: `Parse error: ${match[1] ?? ""}`, line: Number(match[2]) };
}

/** Makes error text refer to the user's file rather than internal paths. */
function tidy(errors: string): string {
  return errors.replaceAll(`${WORK_DIR}/`, "");
}

/** Host-agnostic PHP handler; the worker supplies the web build, tests the Node build. */
export function createPhpHandler(loadRuntime: () => Promise<PHP>): RuntimeHandler {
  let php: PhpLike | undefined;

  return {
    async init(ctx: HandlerContext) {
      ctx.progress("downloading", "PHP 8.4 (WebAssembly)");
      const runtime = await loadRuntime();
      ctx.progress("initializing");
      runtime.mkdir(WORK_DIR);
      runtime.writeFile(HARNESS, harnessSource);
      php = runtime;
    },

    async execute(request, ctx): Promise<RawOutcome> {
      if (!php) throw new Error("PHP runtime is not initialized.");
      php.writeFile(SOLUTION, request.source);
      const response = await runPhp(php, { scriptPath: SOLUTION });
      if (response.text) ctx.stdout(response.text);
      if (response.errors) ctx.stderr(tidy(response.errors));
      const parse = parseErrorDiagnostic(response.errors);
      if (parse)
        return {
          status: "compile-error",
          exitCode: response.exitCode,
          diagnostics: [parse],
          message: parse.message,
        };
      if (response.exitCode !== 0) {
        return {
          status: "runtime-error",
          exitCode: response.exitCode,
          diagnostics: [],
          message: /Fatal error/.test(response.errors)
            ? "The script ended with a fatal error."
            : `The script exited with code ${response.exitCode}.`,
        };
      }
      return { status: "success", exitCode: 0, diagnostics: [] };
    },

    async runTests(request, ctx): Promise<RawOutcome> {
      if (!php) throw new Error("PHP runtime is not initialized.");
      php.writeFile(SOLUTION, request.source);
      // Validate syntax without executing anything.
      const lint = await runPhp(php, {
        code: `<?php try { token_get_all(file_get_contents('${SOLUTION}'), TOKEN_PARSE); } catch (ParseError $e) { echo json_encode(['line' => $e->getLine(), 'message' => $e->getMessage()]); }`,
      });
      if (lint.text.trim()) {
        const { line, message } = JSON.parse(lint.text) as { line: number; message: string };
        ctx.stderr(`Parse error: ${message} on line ${line}\n`);
        return {
          status: "compile-error",
          exitCode: 255,
          diagnostics: [{ severity: "error", message: `Parse error: ${message}`, line }],
          message: `Parse error: ${message}`,
        };
      }

      const prelude = request.prelude.replace(/^\s*<\?php\s*/, "");
      for (const testCase of request.cases) {
        const nonce = createNonce();
        php.writeFile(
          TEST_FILE,
          `<?php\nrequire '${HARNESS}';\nrequire_once '${SOLUTION}';\n${prelude}\n__ccl_run('${nonce}', '${testCase.id}', function () {\n${testCase.code}\n});\n`,
        );
        ctx.startTest(testCase.id);
        const response = await runPhp(php, { scriptPath: TEST_FILE });
        const { output, results } = scanProtocolOutput(response.text, nonce);
        const cleaned = output.replace(/^\n+|\n+$/g, "");
        if (cleaned) ctx.stdout(`${cleaned}\n`);
        if (response.errors) ctx.stderr(tidy(response.errors));
        const result = results.find((r) => r.id === testCase.id);
        if (result) {
          ctx.reportTest(result);
        } else {
          // The request died before reporting: a fatal error while loading, or exit().
          const fatal = /PHP (?:Fatal|Parse) error:\s+(.*)/.exec(response.errors)?.[1];
          if (/__ccl_test\.php/.test(response.errors) && /Parse error/.test(response.errors)) {
            return {
              status: "internal-error",
              exitCode: null,
              diagnostics: [],
              message: `The test "${testCase.id}" has invalid PHP syntax — the challenge definition is invalid.`,
            };
          }
          ctx.reportTest({
            id: testCase.id,
            status: "error",
            message: fatal
              ? tidy(fatal)
              : `The script ended before the test finished (exit code ${response.exitCode}).`,
          });
        }
      }
      return { status: "success", exitCode: 0, diagnostics: [] };
    },
  };
}
