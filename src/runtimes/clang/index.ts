import { SandboxRuntime } from "../core/sandbox-host";
import { workerEndpoint } from "../core/worker-endpoint";

const support = () =>
  typeof WebAssembly === "undefined"
    ? { supported: false as const, reason: "This browser does not support WebAssembly." }
    : { supported: true as const };

// Separate workers so C and C++ can be warm at the same time; the toolchain download is shared via the HTTP cache.
export function createCRuntime(): SandboxRuntime {
  return new SandboxRuntime({
    language: "c",
    initTimeoutMs: 300_000,
    createEndpoint: () =>
      Promise.resolve(
        workerEndpoint(
          new Worker(new URL("./c.worker.ts", import.meta.url), {
            type: "module",
            name: "c-runtime",
          }),
        ),
      ),
    isSupported: support,
  });
}

export function createCppRuntime(): SandboxRuntime {
  return new SandboxRuntime({
    language: "cpp",
    initTimeoutMs: 300_000,
    createEndpoint: () =>
      Promise.resolve(
        workerEndpoint(
          new Worker(new URL("./cpp.worker.ts", import.meta.url), {
            type: "module",
            name: "cpp-runtime",
          }),
        ),
      ),
    isSupported: support,
  });
}
