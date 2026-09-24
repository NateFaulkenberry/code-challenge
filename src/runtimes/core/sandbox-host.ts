import type {
  ExecutionResult,
  ExecutionStatus,
  TestResult,
  TestRunResult,
} from "@/domain/execution";
import type { LanguageId } from "@/domain/languages";
import { DEFAULT_OUTPUT_LIMIT, OutputBuffer } from "./output";
import type { HostMessage, RuntimeMessage } from "./protocol";
import { normalizeTestResults } from "./test-protocol";
import type {
  ExecutionRequest,
  InitProgress,
  LanguageRuntime,
  RawOutcome,
  RuntimeSupport,
  TestRunRequest,
} from "./types";

/** An isolated execution context (Web Worker or sandboxed iframe) reached through a private port. */
export interface SandboxEndpoint {
  port: MessagePort;
  /** Registers a callback for unrecoverable failures (worker error, iframe gone). */
  onCrash(callback: (message: string) => void): void;
  destroy(): void;
}

export type EndpointFactory = () => Promise<SandboxEndpoint>;

export interface SandboxRuntimeOptions {
  language: LanguageId;
  createEndpoint: EndpointFactory;
  isSupported?: () => RuntimeSupport;
  /** Budget for downloading/initialising the toolchain; separate from execution timeouts. */
  initTimeoutMs?: number;
  outputLimit?: number;
  now?: () => number;
}

type Payload =
  | { type: "execute"; source: string; stdin?: string }
  | { type: "test"; source: string; prelude: string; cases: TestRunRequest["cases"] };

interface RunTrace {
  outcome?: RawOutcome;
  stdout: OutputBuffer;
  stderr: OutputBuffer;
  tests: TestResult[];
  runningTest?: string;
  terminal?: {
    status: Extract<ExecutionStatus, "timeout" | "cancelled" | "internal-error">;
    message: string;
  };
  durationMs: number;
}

const DEFAULT_INIT_TIMEOUT_MS = 180_000;

/**
 * Generic host for sandboxed runtimes. It owns the endpoint's lifecycle and
 * enforces the safety rules every language shares:
 *
 *  - one request at a time (requests queue);
 *  - wall-clock timeout → the endpoint is destroyed and lazily recreated;
 *  - cancellation via AbortSignal (same mechanism);
 *  - stdout/stderr capped per run;
 *  - crashes become `internal-error` results, never thrown exceptions.
 */
export class SandboxRuntime implements LanguageRuntime {
  readonly kind = "browser" as const;
  readonly language: LanguageId;

  private endpoint: SandboxEndpoint | undefined;
  private ready: Promise<void> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private nextRequestId = 1;
  private crashListener: ((message: string) => void) | undefined;
  private readonly options: Required<Omit<SandboxRuntimeOptions, "isSupported">> &
    Pick<SandboxRuntimeOptions, "isSupported">;

  constructor(options: SandboxRuntimeOptions) {
    this.language = options.language;
    this.options = {
      initTimeoutMs: DEFAULT_INIT_TIMEOUT_MS,
      outputLimit: DEFAULT_OUTPUT_LIMIT,
      now: () => performance.now(),
      ...options,
    };
  }

  isSupported(): RuntimeSupport {
    return this.options.isSupported?.() ?? { supported: true };
  }

  initialize(onProgress?: (progress: InitProgress) => void): Promise<void> {
    this.ready ??= this.boot(onProgress).catch((error: unknown) => {
      this.teardown();
      throw error;
    });
    return this.ready;
  }

  execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.enqueue(async () => {
      const trace = await this.run(
        {
          type: "execute",
          source: request.source,
          ...(request.stdin !== undefined ? { stdin: request.stdin } : {}),
        },
        request,
      );
      return toExecutionResult(trace);
    });
  }

  runTests(request: TestRunRequest): Promise<TestRunResult> {
    return this.enqueue(async () => {
      const trace = await this.run(
        { type: "test", source: request.source, prelude: request.prelude, cases: request.cases },
        request,
      );
      const execution = toExecutionResult(trace);
      const crashMessage =
        execution.status === "success"
          ? undefined
          : (execution.message ?? "The test run did not complete.");
      return {
        execution,
        results: normalizeTestResults(
          request.cases.map((c) => c.id),
          trace.tests,
          {
            ...(trace.runningTest !== undefined ? { runningId: trace.runningTest } : {}),
            timedOut: execution.status === "timeout",
            ...(crashMessage !== undefined ? { crashMessage } : {}),
          },
        ),
        includedHidden: request.includedHidden,
        finishedAt: new Date().toISOString(),
      };
    });
  }

  dispose(): void {
    this.teardown();
  }

  /**
   * Discards the current endpoint; the next request lazily creates a new one.
   * Any in-flight request resolves as an internal error.
   */
  restart(): void {
    this.crashListener?.("The runtime was restarted.");
    this.teardown();
  }

  /* ---------------------------------------------------------------- */

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async boot(onProgress?: (progress: InitProgress) => void): Promise<void> {
    const endpoint = await this.options.createEndpoint();
    this.endpoint = endpoint;
    endpoint.onCrash((message) => this.crashListener?.(message));
    const trace = await this.exchange(
      { type: "init" },
      this.options.initTimeoutMs,
      undefined,
      onProgress,
    );
    if (trace.terminal || trace.outcome?.status !== "success") {
      throw new RuntimeInitError(
        trace.terminal?.message ?? trace.outcome?.message ?? "The runtime failed to start.",
        trace.stderr.toString(),
      );
    }
    onProgress?.({ stage: "ready" });
  }

  private async run(
    payload: Payload,
    request: { timeoutMs: number; signal?: AbortSignal },
  ): Promise<RunTrace> {
    try {
      await this.initialize();
    } catch (error) {
      return failedTrace(
        error instanceof Error ? error.message : String(error),
        this.options.outputLimit,
      );
    }
    const trace = await this.exchange(payload, request.timeoutMs, request.signal);
    if (trace.terminal) this.teardown();
    return trace;
  }

  /**
   * Sends one request and collects streamed messages until `done`, timeout,
   * abort or crash — whichever comes first.
   */
  private exchange(
    payload: Payload | { type: "init" },
    timeoutMs: number,
    signal?: AbortSignal,
    onProgress?: (progress: InitProgress) => void,
  ): Promise<RunTrace> {
    const endpoint = this.endpoint;
    const limit = this.options.outputLimit;
    const trace: RunTrace = {
      stdout: new OutputBuffer(limit),
      stderr: new OutputBuffer(limit),
      tests: [],
      durationMs: 0,
    };
    if (!endpoint) return Promise.resolve(failedTrace("The runtime is not running.", limit));

    const requestId = this.nextRequestId++;
    const started = this.options.now();

    return new Promise<RunTrace>((resolve) => {
      let settled = false;
      const finish = (terminal?: RunTrace["terminal"]) => {
        if (settled) return;
        settled = true;
        if (terminal) trace.terminal = terminal;
        trace.durationMs = Math.max(0, this.options.now() - started);
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        endpoint.port.removeEventListener("message", onMessage);
        this.crashListener = undefined;
        resolve(trace);
      };

      const onMessage = (event: MessageEvent<RuntimeMessage>) => {
        const message = event.data;
        if (message.requestId !== requestId) return;
        switch (message.type) {
          case "progress":
            onProgress?.({
              stage: message.stage,
              ...(message.detail ? { detail: message.detail } : {}),
            });
            break;
          case "stdout":
            trace.stdout.append(message.text);
            break;
          case "stderr":
            trace.stderr.append(message.text);
            break;
          case "test-start":
            trace.runningTest = message.id;
            break;
          case "test-result":
            trace.tests.push(message.result);
            break;
          case "done":
            trace.outcome = message.outcome;
            finish();
            break;
        }
      };
      const onAbort = () => finish({ status: "cancelled", message: "Execution was cancelled." });
      const timer = setTimeout(
        () =>
          finish({
            status: "timeout",
            message: `Execution exceeded the ${formatSeconds(timeoutMs)} time limit and was stopped.`,
          }),
        timeoutMs,
      );

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      this.crashListener = (message) => finish({ status: "internal-error", message });
      endpoint.port.addEventListener("message", onMessage);
      endpoint.port.start();
      endpoint.port.postMessage({ ...payload, requestId } satisfies HostMessage);
    });
  }

  private teardown(): void {
    this.endpoint?.destroy();
    this.endpoint = undefined;
    this.ready = undefined;
  }
}

export class RuntimeInitError extends Error {
  constructor(
    message: string,
    readonly details: string,
  ) {
    super(message);
    this.name = "RuntimeInitError";
  }
}

function failedTrace(message: string, limit: number): RunTrace {
  return {
    stdout: new OutputBuffer(limit),
    stderr: new OutputBuffer(limit),
    tests: [],
    durationMs: 0,
    terminal: { status: "internal-error", message },
  };
}

function formatSeconds(ms: number): string {
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}

function toExecutionResult(trace: RunTrace): ExecutionResult {
  const status: ExecutionStatus =
    trace.terminal?.status ?? trace.outcome?.status ?? "internal-error";
  const message = trace.terminal?.message ?? trace.outcome?.message;
  return {
    status,
    stdout: trace.stdout.toString(),
    stderr: trace.stderr.toString(),
    exitCode: trace.terminal ? null : (trace.outcome?.exitCode ?? null),
    durationMs: Math.round(trace.durationMs),
    truncated: trace.stdout.truncated || trace.stderr.truncated,
    diagnostics: trace.outcome?.diagnostics ?? [],
    ...(message !== undefined ? { message } : {}),
  };
}
