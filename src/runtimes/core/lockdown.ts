/**
 * Capabilities removed from a worker's global scope before user code runs.
 * The worker realm and termination are the real isolation boundary; this is
 * defence in depth against code that tries to reach the network or the
 * origin's storage (IndexedDB is reachable from same-origin workers).
 */
export const BLOCKED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "WebTransport",
  "EventSource",
  "indexedDB",
  "caches",
  "cookieStore",
  "importScripts",
  "BroadcastChannel",
  "Worker",
  "SharedWorker",
  "RTCPeerConnection",
] as const;

export function lockDownGlobals(scope: object = globalThis): void {
  for (const name of BLOCKED_GLOBALS) {
    try {
      Object.defineProperty(scope, name, {
        value: undefined,
        writable: false,
        configurable: false,
      });
    } catch {
      // Property is non-configurable in this environment; nothing more to do.
    }
  }
}
