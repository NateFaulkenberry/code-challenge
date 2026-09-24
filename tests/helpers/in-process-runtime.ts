import type { LanguageId } from "@/domain/languages";
import { CONNECT_MESSAGE } from "@/runtimes/core/protocol";
import {
  SandboxRuntime,
  type SandboxEndpoint,
  type SandboxRuntimeOptions,
} from "@/runtimes/core/sandbox-host";
import { serveRuntime } from "@/runtimes/core/serve";
import type { RuntimeHandler } from "@/runtimes/core/types";

export interface InProcessEndpointStats {
  created: number;
  destroyed: number;
  crash(message: string): void;
}

/**
 * Serves a handler over a real MessageChannel in the current realm. Exercises
 * the full host ⇄ runtime protocol without a Worker (unavailable in Node/jsdom).
 */
export function inProcessEndpointFactory(handler: RuntimeHandler): {
  factory: () => Promise<SandboxEndpoint>;
  stats: InProcessEndpointStats;
} {
  let crashCallback: ((message: string) => void) | undefined;
  const stats: InProcessEndpointStats = {
    created: 0,
    destroyed: 0,
    crash: (message) => crashCallback?.(message),
  };
  const factory = () => {
    stats.created++;
    const listeners: ((event: MessageEvent) => void)[] = [];
    serveRuntime(handler, {
      target: { addEventListener: (_type, listener) => listeners.push(listener) },
    });
    const channel = new MessageChannel();
    const connect = { data: CONNECT_MESSAGE, ports: [channel.port2] } as unknown as MessageEvent;
    listeners.forEach((listener) => listener(connect));
    return Promise.resolve<SandboxEndpoint>({
      port: channel.port1,
      onCrash: (callback) => {
        crashCallback = callback;
      },
      destroy: () => {
        stats.destroyed++;
        channel.port1.close();
        channel.port2.close();
      },
    });
  };
  return { factory, stats };
}

export function createInProcessRuntime(
  language: LanguageId,
  handler: RuntimeHandler,
  options: Partial<SandboxRuntimeOptions> = {},
): { runtime: SandboxRuntime; stats: InProcessEndpointStats } {
  const { factory, stats } = inProcessEndpointFactory(handler);
  return { runtime: new SandboxRuntime({ language, createEndpoint: factory, ...options }), stats };
}
