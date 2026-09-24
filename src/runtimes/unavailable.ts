import type { ExecutionResult, TestRunResult } from "@/domain/execution";
import type { LanguageId } from "@/domain/languages";
import type { LanguageRuntime, RuntimeSupport } from "./core/types";

/**
 * Honest placeholder for a language whose runtime can't run here. It never
 * pretends to execute: every call reports the reason.
 */
export class UnavailableRuntime implements LanguageRuntime {
  readonly kind = "browser" as const;

  constructor(
    readonly language: LanguageId,
    private readonly reason: string,
  ) {}

  isSupported(): RuntimeSupport {
    return { supported: false, reason: this.reason };
  }

  initialize(): Promise<void> {
    return Promise.reject(new Error(this.reason));
  }

  execute(): Promise<ExecutionResult> {
    return Promise.resolve(this.result());
  }

  runTests(request: {
    cases: readonly { id: string }[];
    includedHidden: boolean;
  }): Promise<TestRunResult> {
    return Promise.resolve({
      execution: this.result(),
      results: request.cases.map((c) => ({
        id: c.id,
        status: "not-run" as const,
        message: this.reason,
      })),
      includedHidden: request.includedHidden,
      finishedAt: new Date().toISOString(),
    });
  }

  dispose(): void {}

  private result(): ExecutionResult {
    return {
      status: "internal-error",
      stdout: "",
      stderr: "",
      exitCode: null,
      durationMs: 0,
      truncated: false,
      diagnostics: [],
      message: this.reason,
    };
  }
}
