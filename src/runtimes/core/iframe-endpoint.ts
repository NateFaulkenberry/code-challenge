import { CONNECT_MESSAGE } from "./protocol";
import type { SandboxEndpoint } from "./sandbox-host";

export const SANDBOX_ATTRIBUTES = "allow-scripts";

/**
 * Creates a sandboxed iframe (`sandbox="allow-scripts"` without
 * `allow-same-origin`, so its origin is opaque: no access to the parent's DOM,
 * storage or cookies, no top-level navigation, no popups) and connects to the
 * runtime inside it over a private MessageChannel.
 */
export function createIframeEndpoint(options: {
  parent: HTMLElement;
  src: string;
  title: string;
  loadTimeoutMs?: number;
}): Promise<SandboxEndpoint> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", SANDBOX_ATTRIBUTES);
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.title = options.title;
  iframe.src = options.src;
  iframe.className = "ccl-sandbox-frame";
  iframe.style.cssText = "border:0;width:100%;height:100%;display:block;background:transparent;";

  return new Promise<SandboxEndpoint>((resolve, reject) => {
    const channel = new MessageChannel();
    let crashCallback: ((message: string) => void) | undefined;
    const timer = setTimeout(() => {
      cleanup();
      iframe.remove();
      reject(new Error("The sandbox page did not load."));
    }, options.loadTimeoutMs ?? 30_000);

    // The sandbox announces readiness once its runtime is listening.
    const onReady = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || event.data !== "ccl:sandbox-ready") return;
      cleanup();
      // Opaque origin: "*" is the only possible target, and the port goes only to this window.
      iframe.contentWindow?.postMessage(CONNECT_MESSAGE, "*", [channel.port2]);
      resolve({
        port: channel.port1,
        onCrash: (callback) => {
          crashCallback = callback;
        },
        destroy: () => {
          crashCallback = undefined;
          channel.port1.close();
          iframe.remove();
        },
      });
    };
    const onError = () => crashCallback?.("The sandbox failed to load.");
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onReady);
    };
    window.addEventListener("message", onReady);
    iframe.addEventListener("error", onError);
    options.parent.append(iframe);
  });
}
