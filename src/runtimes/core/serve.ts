import { OutputBuffer, DEFAULT_OUTPUT_LIMIT } from "./output";
import { CONNECT_MESSAGE, type HostMessage, type RuntimeMessage } from "./protocol";
import type { HandlerContext, RawOutcome, RuntimeHandler } from "./types";

export interface ServeOptions {
  /** Where the connect message arrives (worker global scope or iframe window). */
  target: {
    addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  };
  /** For iframes: accept connect only from this window. */
  acceptSource?: (event: MessageEvent) => boolean;
  outputLimit?: number;
}

/**
 * Runtime-side counterpart to SandboxRuntime. Waits for the host to hand over
 * a private MessagePort, then dispatches requests to the language handler.
 */
export function serveRuntime(handler: RuntimeHandler, options: ServeOptions): void {
  let port: MessagePort | undefined;
  let initialized: Promise<void> | undefined;

  options.target.addEventListener("message", (event: MessageEvent) => {
    if (port || event.data !== CONNECT_MESSAGE || !event.ports[0]) return;
    if (options.acceptSource && !options.acceptSource(event)) return;
    port = event.ports[0];
    const connected = port;
    connected.onmessage = (message: MessageEvent<HostMessage>) => {
      void handle(connected, message.data);
    };
  });

  async function handle(port: MessagePort, message: HostMessage): Promise<void> {
    const { requestId } = message;
    const send = (msg: RuntimeMessage) => port.postMessage(msg);
    // Enforce the cap before posting too, so a flood never crosses the port.
    const limit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT;
    const stdout = new OutputBuffer(limit);
    const stderr = new OutputBuffer(limit);
    const ctx: HandlerContext = {
      progress: (stage, detail) =>
        send({ type: "progress", requestId, stage, ...(detail ? { detail } : {}) }),
      stdout: (text) => {
        const accepted = stdout.append(text);
        if (accepted) send({ type: "stdout", requestId, text: accepted });
      },
      stderr: (text) => {
        const accepted = stderr.append(text);
        if (accepted) send({ type: "stderr", requestId, text: accepted });
      },
      startTest: (id) => send({ type: "test-start", requestId, id }),
      reportTest: (result) => send({ type: "test-result", requestId, result }),
    };

    let outcome: RawOutcome;
    try {
      if (message.type === "init") {
        initialized ??= handler.init(ctx);
        await initialized;
        outcome = { status: "success", exitCode: 0, diagnostics: [] };
      } else {
        await initialized;
        outcome =
          message.type === "execute"
            ? await handler.execute(
                {
                  source: message.source,
                  ...(message.stdin !== undefined ? { stdin: message.stdin } : {}),
                },
                ctx,
              )
            : await handler.runTests(
                { source: message.source, prelude: message.prelude, cases: message.cases },
                ctx,
              );
      }
    } catch (error) {
      if (message.type === "init") initialized = undefined;
      outcome = {
        status: "internal-error",
        exitCode: null,
        diagnostics: [],
        message: error instanceof Error ? error.message : String(error),
      };
    }
    send({ type: "done", requestId, outcome });
  }
}
