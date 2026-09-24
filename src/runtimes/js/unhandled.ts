/**
 * Subscribes to unhandled promise rejections in whichever host we're in:
 * browsers (Worker/iframe) dispatch `unhandledrejection`; Node (tests) emits
 * it on `process`.
 */
export function onUnhandledRejection(callback: (reason: unknown) => void): () => void {
  if (
    typeof globalThis.addEventListener === "function" &&
    typeof PromiseRejectionEvent !== "undefined"
  ) {
    const listener = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      callback(event.reason);
    };
    globalThis.addEventListener("unhandledrejection", listener);
    return () => globalThis.removeEventListener("unhandledrejection", listener);
  }
  const nodeProcess = (globalThis as { process?: NodeLikeProcess }).process;
  if (nodeProcess?.on) {
    const listener = (reason: unknown) => callback(reason);
    nodeProcess.on("unhandledRejection", listener);
    return () => nodeProcess.off("unhandledRejection", listener);
  }
  return () => undefined;
}

interface NodeLikeProcess {
  on(event: "unhandledRejection", listener: (reason: unknown) => void): void;
  off(event: "unhandledRejection", listener: (reason: unknown) => void): void;
}
