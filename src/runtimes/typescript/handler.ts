import { LANGUAGES } from "@/domain/languages";
import type { RuntimeHandler } from "../core/types";
import { runJsProgram, runJsTests, type JsRunnerConfig } from "../js/runner";

const config: JsRunnerConfig = {
  solutionFile: LANGUAGES.typescript.solutionFile,
  jsx: false,
  modules: {},
};

/** Host-agnostic: runs in the worker, and directly in Node for tests. */
export const typescriptHandler: RuntimeHandler = {
  init: () => Promise.resolve(),
  execute: (request, ctx) => runJsProgram(request.source, config, ctx),
  runTests: (request, ctx) => runJsTests(request, config, ctx),
};
