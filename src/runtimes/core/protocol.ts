import type { TestResult } from "@/domain/execution";
import type { InitStage, RawOutcome, TestCaseSource } from "./types";

/**
 * Host → runtime messages. The first message is `connect`, which transfers a
 * private MessagePort; every later exchange goes over that port so user code
 * (which only sees the worker's globals) cannot forge replies with `postMessage`.
 */
export type HostMessage =
  | { type: "init"; requestId: number }
  | { type: "execute"; requestId: number; source: string; stdin?: string }
  | {
      type: "test";
      requestId: number;
      source: string;
      prelude: string;
      cases: readonly TestCaseSource[];
    };

export type RuntimeMessage =
  | { type: "progress"; requestId: number; stage: InitStage; detail?: string }
  | { type: "stdout" | "stderr"; requestId: number; text: string }
  | { type: "test-start"; requestId: number; id: string }
  | { type: "test-result"; requestId: number; result: TestResult }
  | { type: "done"; requestId: number; outcome: RawOutcome };

export const CONNECT_MESSAGE = "ccl:connect";
