import { CONNECT_MESSAGE } from "./protocol";
import type { SandboxEndpoint } from "./sandbox-host";

/** Wraps a freshly constructed Worker as a SandboxEndpoint. */
export function workerEndpoint(worker: Worker): SandboxEndpoint {
  const channel = new MessageChannel();
  let crashCallback: ((message: string) => void) | undefined;
  worker.addEventListener("error", (event) => {
    event.preventDefault();
    crashCallback?.(event.message || "The runtime worker crashed.");
  });
  worker.addEventListener("messageerror", () =>
    crashCallback?.("The runtime sent an unreadable message."),
  );
  worker.postMessage(CONNECT_MESSAGE, [channel.port2]);
  return {
    port: channel.port1,
    onCrash: (callback) => {
      crashCallback = callback;
    },
    destroy: () => {
      worker.terminate();
      channel.port1.close();
    },
  };
}
