import type { Diagnostic, ExecutionResult, TestResult, TestRunResult } from "@/domain/execution";
import type { LanguageId } from "@/domain/languages";

export type RuntimeKind = "browser" | "remote";

export type RuntimeSupport = { supported: true } | { supported: false; reason: string };

export type InitStage = "downloading" | "initializing" | "ready";

export interface InitProgress {
  stage: InitStage;
  detail?: string;
}

export interface ExecutionRequest {
  source: string;
  stdin?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface TestCaseSource {
  id: string;
  code: string;
}

export interface TestRunRequest {
  source: string;
  prelude: string;
  cases: readonly TestCaseSource[];
  includedHidden: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
}

/**
 * The contract every language adapter implements. The UI only ever sees this
 * interface — never workers, iframes, compilers or WASM modules.
 */
export interface LanguageRuntime {
  readonly language: LanguageId;
  readonly kind: RuntimeKind;
  isSupported(): RuntimeSupport;
  initialize(onProgress?: (progress: InitProgress) => void): Promise<void>;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  runTests(request: TestRunRequest): Promise<TestRunResult>;
  dispose(): void;
}

/* ---------- Worker-side (handler) contract ---------- */

export type RawStatus = "success" | "runtime-error" | "compile-error" | "internal-error";

/** What a handler reports once its work completes; streaming output goes through the context. */
export interface RawOutcome {
  status: RawStatus;
  exitCode: number | null;
  diagnostics: Diagnostic[];
  message?: string;
}

/** Callbacks are plain function properties so handlers can pass them along directly. */
export interface HandlerContext {
  progress: (stage: InitStage, detail?: string) => void;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  reportTest: (result: TestResult) => void;
  /** Marks which test is running, so a timeout can be attributed to it. */
  startTest: (id: string) => void;
}

export interface RuntimeHandler {
  init(ctx: HandlerContext): Promise<void>;
  execute(request: { source: string; stdin?: string }, ctx: HandlerContext): Promise<RawOutcome>;
  runTests(
    request: { source: string; prelude: string; cases: readonly TestCaseSource[] },
    ctx: HandlerContext,
  ): Promise<RawOutcome>;
}
