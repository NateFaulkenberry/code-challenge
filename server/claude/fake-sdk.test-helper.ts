/**
 * A fake of the Agent SDK boundary (agent-sdk.ts). It behaves like a Claude
 * Code session: account info first, then — only once a prompt arrives — the
 * scripted messages. It records every prompt that would have reached Claude.
 */
import type { AccountInfo, AgentSdk, Options, SDKMessage } from "./agent-sdk.ts";

export interface FakeScript {
  account?: AccountInfo | Error;
  accountDelayMs?: number;
  messages?: object[];
  /** Never produce a result (until aborted). */
  hang?: boolean;
  iterateError?: Error;
}

export interface FakeSdk extends AgentSdk {
  options: Options[];
  promptsSent: string[];
}

export const READY_ACCOUNT: AccountInfo = {
  subscriptionType: "Claude Max",
  apiProvider: "firstParty",
  email: "dev@example.com",
};

export function initMessage(apiKeySource = "none", model = "claude-opus-5-5"): object {
  return {
    type: "system",
    subtype: "init",
    apiKeySource,
    model,
    tools: [],
    cwd: "/tmp",
    mcp_servers: [],
  };
}

export function successResult(text: string): object {
  return { type: "result", subtype: "success", is_error: false, result: text };
}

export function fakeSdk(script: FakeScript): FakeSdk {
  const options: Options[] = [];
  const promptsSent: string[] = [];
  return {
    options,
    promptsSent,
    query({ prompt, options: opts }) {
      options.push(opts);
      const signal = opts.abortController?.signal;
      const untilAborted = () =>
        new Promise<never>((_, reject) => {
          if (signal?.aborted) reject(new Error("aborted"));
          signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      return {
        async accountInfo() {
          if (script.accountDelayMs)
            await Promise.race([
              new Promise((r) => setTimeout(r, script.accountDelayMs)),
              untilAborted(),
            ]);
          if (script.account instanceof Error) throw script.account;
          return script.account ?? READY_ACCOUNT;
        },
        async *[Symbol.asyncIterator]() {
          for await (const message of prompt) {
            const content = message.message.content;
            promptsSent.push(typeof content === "string" ? content : JSON.stringify(content));
            break;
          }
          if (script.iterateError) throw script.iterateError;
          for (const message of script.messages ?? [initMessage(), successResult("ok")])
            yield message as SDKMessage;
          if (script.hang) await untilAborted();
        },
      };
    },
  };
}
