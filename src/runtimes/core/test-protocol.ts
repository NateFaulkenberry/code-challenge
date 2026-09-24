import { TestStatusSchema, type TestResult } from "@/domain/execution";

/**
 * Harnesses for stdout-based runtimes (Python, PHP, C, C++, Java) report each
 * test as one line: `\x1eCCL:<nonce>:<json>`. The record separator plus a
 * per-run nonce means ordinary program output can't be mistaken for a result.
 */
export const PROTOCOL_PREFIX = "\u001eCCL:";

export function createNonce(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ProtocolScan {
  /** Output with protocol lines removed. */
  output: string;
  results: TestResult[];
}

export function scanProtocolOutput(text: string, nonce: string): ProtocolScan {
  const marker = `${PROTOCOL_PREFIX}${nonce}:`;
  const results: TestResult[] = [];
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    const at = line.indexOf(marker);
    if (at === -1) {
      kept.push(line);
      continue;
    }
    if (at > 0) kept.push(line.slice(0, at));
    const parsed = parseResultJson(line.slice(at + marker.length));
    if (parsed) results.push(parsed);
  }
  return { output: kept.join("\n"), results };
}

function parseResultJson(json: string): TestResult | undefined {
  try {
    const value = JSON.parse(json) as Record<string, unknown>;
    const status = TestStatusSchema.safeParse(value.status);
    if (typeof value.id !== "string" || !status.success) return undefined;
    return {
      id: value.id,
      status: status.data,
      ...(typeof value.message === "string" && value.message
        ? { message: value.message.slice(0, 2_000) }
        : {}),
      ...(typeof value.durationMs === "number" ? { durationMs: value.durationMs } : {}),
    };
  } catch {
    return undefined;
  }
}

/**
 * Line-oriented streaming variant: feed arbitrary chunks, get back the
 * non-protocol text immediately and results as their lines complete.
 */
export class ProtocolStream {
  private pending = "";

  constructor(
    private readonly nonce: string,
    private readonly onText: (text: string) => void,
    private readonly onResult: (result: TestResult) => void,
  ) {}

  push(chunk: string): void {
    const data = this.pending + chunk;
    const lastNewline = data.lastIndexOf("\n");
    if (lastNewline === -1) {
      this.pending = data;
      return;
    }
    this.pending = data.slice(lastNewline + 1);
    this.emit(data.slice(0, lastNewline + 1));
  }

  flush(): void {
    if (this.pending) this.emit(this.pending);
    this.pending = "";
  }

  private emit(text: string): void {
    const { output, results } = scanProtocolOutput(text, this.nonce);
    if (output) this.onText(output);
    results.forEach(this.onResult);
  }
}

/**
 * Produces exactly one result per requested case, in request order.
 * Cases that never reported are `timeout` (if they were running when the run
 * was killed) or `not-run`.
 */
export function normalizeTestResults(
  caseIds: readonly string[],
  reported: readonly TestResult[],
  options: { runningId?: string; timedOut: boolean; crashMessage?: string },
): TestResult[] {
  const byId = new Map<string, TestResult>();
  for (const result of reported) if (!byId.has(result.id)) byId.set(result.id, result);
  return caseIds.map((id) => {
    const result = byId.get(id);
    if (result) return result;
    if (options.timedOut && id === options.runningId) {
      return { id, status: "timeout", message: "Exceeded the time limit." };
    }
    return {
      id,
      status: "not-run",
      ...(options.crashMessage ? { message: options.crashMessage } : {}),
    };
  });
}
