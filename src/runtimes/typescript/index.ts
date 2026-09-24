import { SandboxRuntime } from "../core/sandbox-host";
import { workerEndpoint } from "../core/worker-endpoint";

export function createTypescriptRuntime(): SandboxRuntime {
  return new SandboxRuntime({
    language: "typescript",
    createEndpoint: () =>
      Promise.resolve(
        workerEndpoint(
          new Worker(new URL("./typescript.worker.ts", import.meta.url), {
            type: "module",
            name: "typescript-runtime",
          }),
        ),
      ),
    isSupported: () =>
      typeof Worker === "undefined"
        ? { supported: false, reason: "This browser does not support Web Workers." }
        : { supported: true },
  });
}
