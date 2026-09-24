import { SandboxRuntime } from "../core/sandbox-host";
import { workerEndpoint } from "../core/worker-endpoint";

export function createPhpRuntime(): SandboxRuntime {
  return new SandboxRuntime({
    language: "php",
    createEndpoint: () =>
      Promise.resolve(
        workerEndpoint(
          new Worker(new URL("./php.worker.ts", import.meta.url), {
            type: "module",
            name: "php-runtime",
          }),
        ),
      ),
    isSupported: () =>
      typeof WebAssembly === "undefined"
        ? { supported: false, reason: "This browser does not support WebAssembly." }
        : { supported: true },
  });
}
