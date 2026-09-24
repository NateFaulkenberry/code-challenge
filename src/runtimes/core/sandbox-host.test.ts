import { describe, expect, it } from "vitest";
import { createInProcessRuntime } from "../../../tests/helpers/in-process-runtime";
import type { RawOutcome, RuntimeHandler } from "./types";

const ok: RawOutcome = { status: "success", exitCode: 0, diagnostics: [] };

function handler(overrides: Partial<RuntimeHandler>): RuntimeHandler {
  return {
    init: () => Promise.resolve(),
    execute: () => Promise.resolve(ok),
    runTests: () => Promise.resolve(ok),
    ...overrides,
  };
}

const never = () => new Promise<RawOutcome>(() => undefined);

describe("SandboxRuntime", () => {
  it("streams stdout/stderr and reports success with timing", async () => {
    const { runtime } = createInProcessRuntime(
      "typescript",
      handler({
        execute: (_req, ctx) => {
          ctx.stdout("a");
          ctx.stderr("b");
          return Promise.resolve(ok);
        },
      }),
    );
    const result = await runtime.execute({ source: "", timeoutMs: 1000 });
    expect(result).toMatchObject({
      status: "success",
      stdout: "a",
      stderr: "b",
      exitCode: 0,
      truncated: false,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    runtime.dispose();
  });

  it("times out, destroys the endpoint and recovers on the next run", async () => {
    let calls = 0;
    const { runtime, stats } = createInProcessRuntime(
      "typescript",
      handler({ execute: () => (++calls === 1 ? never() : Promise.resolve(ok)) }),
    );
    const timedOut = await runtime.execute({ source: "", timeoutMs: 30 });
    expect(timedOut.status).toBe("timeout");
    expect(timedOut.exitCode).toBeNull();
    expect(timedOut.message).toMatch(/time limit/);
    expect(stats.destroyed).toBe(1);

    const next = await runtime.execute({ source: "", timeoutMs: 1000 });
    expect(next.status).toBe("success");
    expect(stats.created).toBe(2);
    runtime.dispose();
  });

  it("cancels via AbortSignal", async () => {
    const { runtime, stats } = createInProcessRuntime("typescript", handler({ execute: never }));
    const controller = new AbortController();
    const pending = runtime.execute({ source: "", timeoutMs: 5000, signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    expect((await pending).status).toBe("cancelled");
    expect(stats.destroyed).toBe(1);
  });

  it("caps output and flags truncation", async () => {
    const { runtime } = createInProcessRuntime(
      "typescript",
      handler({
        execute: (_req, ctx) => {
          for (let i = 0; i < 100; i++) ctx.stdout("0123456789");
          return Promise.resolve(ok);
        },
      }),
      { outputLimit: 25 },
    );
    const result = await runtime.execute({ source: "", timeoutMs: 1000 });
    expect(result.stdout).toHaveLength(25);
    expect(result.truncated).toBe(true);
    runtime.dispose();
  });

  it("turns a crash into an internal error", async () => {
    const { runtime, stats } = createInProcessRuntime("typescript", handler({ execute: never }));
    await runtime.initialize();
    const pending = runtime.execute({ source: "", timeoutMs: 5000 });
    setTimeout(() => stats.crash("worker exploded"), 10);
    const result = await pending;
    expect(result).toMatchObject({ status: "internal-error", message: "worker exploded" });
  });

  it("reports init failures as internal errors and retries init next time", async () => {
    let attempts = 0;
    const { runtime } = createInProcessRuntime(
      "python",
      handler({
        init: () =>
          ++attempts === 1 ? Promise.reject(new Error("download failed")) : Promise.resolve(),
      }),
    );
    const first = await runtime.execute({ source: "", timeoutMs: 1000 });
    expect(first).toMatchObject({ status: "internal-error", message: "download failed" });
    const second = await runtime.execute({ source: "", timeoutMs: 1000 });
    expect(second.status).toBe("success");
    runtime.dispose();
  });

  it("serializes concurrent requests", async () => {
    const order: string[] = [];
    const { runtime } = createInProcessRuntime(
      "typescript",
      handler({
        execute: async (req) => {
          order.push(`start:${req.source}`);
          await new Promise((r) => setTimeout(r, 10));
          order.push(`end:${req.source}`);
          return ok;
        },
      }),
    );
    await Promise.all([
      runtime.execute({ source: "1", timeoutMs: 1000 }),
      runtime.execute({ source: "2", timeoutMs: 1000 }),
    ]);
    expect(order).toEqual(["start:1", "end:1", "start:2", "end:2"]);
    runtime.dispose();
  });

  it("attributes a timeout to the running test and marks the rest not-run", async () => {
    const { runtime } = createInProcessRuntime(
      "typescript",
      handler({
        runTests: (_req, ctx) => {
          ctx.startTest("a");
          ctx.reportTest({ id: "a", status: "pass" });
          ctx.startTest("b");
          return never();
        },
      }),
    );
    const run = await runtime.runTests({
      source: "",
      prelude: "",
      cases: [
        { id: "a", code: "" },
        { id: "b", code: "" },
        { id: "c", code: "" },
      ],
      includedHidden: false,
      timeoutMs: 30,
    });
    expect(run.results.map((r) => r.status)).toEqual(["pass", "timeout", "not-run"]);
    expect(run.includedHidden).toBe(false);
    runtime.dispose();
  });
});
