/**
 * THE integration boundary with the official Claude Agent SDK
 * (@anthropic-ai/claude-agent-sdk). This is the only file that loads the real
 * SDK; every other module depends on the small `AgentSdk` interface below,
 * which tests replace with a fake. No test ever makes a real Claude request.
 */
import type {
  AccountInfo,
  Options,
  SDKMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

export type { AccountInfo, Options, SDKMessage, SDKUserMessage };

/** The subset of the SDK's `Query` object this integration uses. */
export interface AgentSession extends AsyncIterable<SDKMessage> {
  accountInfo(): Promise<AccountInfo>;
}

export interface AgentSdk {
  query(params: { prompt: AsyncIterable<SDKUserMessage>; options: Options }): AgentSession;
}

/**
 * Loads the SDK lazily so the dev server and the rest of the app work when it
 * isn't installed (it is a devDependency and never part of the static build).
 */
export async function loadAgentSdk(): Promise<AgentSdk> {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  return { query: (params) => sdk.query(params) };
}
