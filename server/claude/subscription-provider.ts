import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AccountInfo,
  AgentSdk,
  AgentSession,
  Options,
  SDKMessage,
  SDKUserMessage,
} from "./agent-sdk.ts";
import type { ClaudeConfig } from "./config.ts";
import { presentApiBillingVariables, redactSecrets, subscriptionEnv } from "./safe-env.ts";
import {
  ClaudeError,
  type ClaudeProvider,
  type ClaudeRequest,
  type ClaudeResponse,
  type ClaudeStatus,
} from "./types.ts";

export interface SubscriptionProviderDeps {
  config: ClaudeConfig;
  env: Record<string, string | undefined>;
  loadSdk: () => Promise<AgentSdk>;
  /** Receives diagnostic lines; secrets are redacted before they get here. */
  log?: (line: string) => void;
  /** Isolated working directory for Claude Code (no project files, no CLAUDE.md). */
  workDir?: () => string;
  statusTimeoutMs?: number;
  now?: () => number;
}

const DEFAULT_STATUS_TIMEOUT_MS = 30_000;

/** An input stream that stays open until released, so account checks happen before any prompt is sent. */
class PromptGate implements AsyncIterable<SDKUserMessage> {
  private message: SDKUserMessage | undefined;
  private wake: (() => void) | undefined;
  private closed = false;
  sent = false;

  send(message: SDKUserMessage): void {
    this.message = message;
    this.wake?.();
  }

  close(): void {
    this.closed = true;
    this.wake?.();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    while (!this.message && !this.closed)
      await new Promise<void>((resolve) => (this.wake = resolve));
    if (this.message && !this.closed) {
      this.sent = true;
      yield this.message;
    }
  }
}

type AuthVerdict =
  | { ok: true; subscription: string }
  | { ok: false; state: "unauthenticated" | "api-key-in-use"; message: string };

/** Decides whether the account Claude Code resolved is a claude.ai subscription with no API key in use. */
export function judgeAccount(
  info: AccountInfo,
  env: Record<string, string | undefined>,
): AuthVerdict {
  if (info.apiKeySource && info.apiKeySource !== "none") {
    return {
      ok: false,
      state: "api-key-in-use",
      message: `Claude Code resolved an API key (source: ${info.apiKeySource}). The local integration only uses your Claude subscription and will not incur API charges, so it refuses to run. Remove the key or apiKeyHelper configuration.`,
    };
  }
  if (info.apiProvider && info.apiProvider !== "firstParty") {
    return {
      ok: false,
      state: "api-key-in-use",
      message: `Claude Code is configured for a third-party provider (${info.apiProvider}), not a Claude subscription.`,
    };
  }
  if (info.subscriptionType) return { ok: true, subscription: info.subscriptionType };
  // A `claude setup-token` token authenticates the subscription but can't read account details.
  // (Third-party providers were rejected above.)
  if ((env.CLAUDE_CODE_OAUTH_TOKEN ?? "") !== "") {
    return { ok: true, subscription: "Claude subscription (long-lived token)" };
  }
  return {
    ok: false,
    state: "unauthenticated",
    message:
      "Claude Code is not signed in with a Claude subscription. Run `npm run claude:setup` for the supported login steps.",
  };
}

function looksUnauthenticated(message: string): boolean {
  return /not logged in|log ?in|login|unauthori[sz]ed|authentication|oauth|expired|credential/i.test(
    message,
  );
}

/**
 * Runs Claude through the official Claude Agent SDK, authenticated with the
 * developer's Claude subscription (the login Claude Code already holds, or a
 * CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`).
 *
 * Guarantees:
 *  - API-billing variables are stripped from the Claude Code environment;
 *  - the account is verified (subscription, no API key) BEFORE the prompt is sent,
 *    and the session's init message is checked again as a second guard;
 *  - Claude Code runs with no tools, no settings files, no MCP servers, one turn,
 *    in an empty temp directory, and without persisting the session;
 *  - requests time out and can be cancelled; secrets never appear in errors or logs.
 */
export class SubscriptionClaudeProvider implements ClaudeProvider {
  readonly kind = "subscription" as const;
  private readonly deps: SubscriptionProviderDeps;
  private sdk: Promise<AgentSdk> | undefined;

  constructor(deps: SubscriptionProviderDeps) {
    this.deps = deps;
  }

  async status(): Promise<ClaudeStatus> {
    const base = {
      provider: "subscription" as const,
      authentication: "claude-subscription" as const,
    };
    const ignored = presentApiBillingVariables(this.deps.env);
    const note = ignored.length ? ` Ignored for this integration: ${ignored.join(", ")}.` : "";
    let sdk: AgentSdk;
    try {
      sdk = await this.loadSdk();
    } catch (error) {
      return {
        ...base,
        state: "error",
        message: `The Claude Agent SDK could not be loaded (${this.safeMessage(error)}). Run \`npm install\`.`,
      };
    }
    const controller = new AbortController();
    const gate = new PromptGate();
    try {
      const session = sdk.query({ prompt: gate, options: this.options(controller, "") });
      const info = await this.withDeadline(
        session.accountInfo(),
        this.deps.statusTimeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS,
        controller,
      );
      const verdict = judgeAccount(info, this.deps.env);
      if (!verdict.ok) return { ...base, state: verdict.state, message: verdict.message + note };
      return {
        ...base,
        state: "ready",
        subscription: verdict.subscription,
        message: `Signed in with ${verdict.subscription}. Requests use your subscription's usage limits.${note}`,
      };
    } catch (error) {
      const message = this.safeMessage(error);
      if (error instanceof ClaudeError && error.code === "timeout") {
        return {
          ...base,
          state: "error",
          message: "Claude Code did not respond to the account check in time.",
        };
      }
      return looksUnauthenticated(message)
        ? {
            ...base,
            state: "unauthenticated",
            message: `Not signed in to Claude (${message}). Run \`npm run claude:setup\`.`,
          }
        : { ...base, state: "error", message: `The account check failed: ${message}` };
    } finally {
      gate.close();
      controller.abort();
    }
  }

  async isAvailable(): Promise<boolean> {
    return (await this.status()).state === "ready";
  }

  async run(request: ClaudeRequest, signal?: AbortSignal): Promise<ClaudeResponse> {
    validateRequest(request);
    const started = (this.deps.now ?? Date.now)();
    let sdk: AgentSdk;
    try {
      sdk = await this.loadSdk();
    } catch (error) {
      throw new ClaudeError(
        "sdk-unavailable",
        `The Claude Agent SDK could not be loaded: ${this.safeMessage(error)}`,
        { cause: error },
      );
    }

    const controller = new AbortController();
    const gate = new PromptGate();
    let reason: "timeout" | "cancelled" | undefined;
    const timer = setTimeout(() => {
      reason ??= "timeout";
      controller.abort();
    }, this.deps.config.timeoutMs);
    const onAbort = () => {
      reason ??= "cancelled";
      controller.abort();
    };
    if (signal?.aborted) onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });

    const aborted = () =>
      reason === "timeout"
        ? new ClaudeError(
            "timeout",
            `Claude did not finish within ${Math.round(this.deps.config.timeoutMs / 1000)}s.`,
          )
        : new ClaudeError("cancelled", "The request was cancelled.");

    try {
      if (controller.signal.aborted) throw aborted();
      const session = sdk.query({
        prompt: gate,
        options: this.options(controller, request.system),
      });

      // 1. Verify the account before anything is sent to the model.
      const verdict = judgeAccount(
        await raceAbort(session.accountInfo(), controller.signal),
        this.deps.env,
      );
      if (!verdict.ok) {
        throw new ClaudeError(
          verdict.state === "api-key-in-use" ? "api-key-in-use" : "unauthenticated",
          verdict.message,
        );
      }

      // 2. Send the prompt and read the single-turn result.
      gate.send(userMessage(flattenConversation(request)));
      return await this.collect(session, controller, started);
    } catch (error) {
      if (error instanceof ClaudeError) throw error;
      if (controller.signal.aborted) throw aborted();
      const message = this.safeMessage(error);
      throw new ClaudeError(
        looksUnauthenticated(message) ? "unauthenticated" : "request-failed",
        message,
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      gate.close();
      controller.abort();
    }
  }

  private async collect(
    session: AgentSession,
    controller: AbortController,
    started: number,
  ): Promise<ClaudeResponse> {
    let model = this.deps.config.model ?? "claude";
    for await (const message of session as AsyncIterable<SDKMessage>) {
      if (controller.signal.aborted) break;
      switch (message.type) {
        case "system":
          if (message.subtype === "init") {
            model = message.model;
            // Second guard: the session itself reports where its credential came from.
            if (message.apiKeySource !== "none") {
              controller.abort();
              throw new ClaudeError(
                "api-key-in-use",
                `The Claude Code session reported an API key (source: ${message.apiKeySource}); refusing to continue.`,
              );
            }
          }
          break;
        case "auth_status":
          if (message.error)
            throw new ClaudeError("unauthenticated", this.safeMessage(message.error));
          break;
        case "assistant":
          if (
            message.error === "authentication_failed" ||
            message.error === "oauth_org_not_allowed"
          ) {
            throw new ClaudeError(
              "unauthenticated",
              "Claude rejected the subscription login. Run `npm run claude:setup`.",
            );
          }
          if (message.error === "rate_limit") {
            throw new ClaudeError(
              "rate-limited",
              "Your Claude subscription's usage limit was reached. Try again after it resets.",
            );
          }
          break;
        case "result":
          if (message.subtype === "success" && !message.is_error) {
            return {
              text: message.result,
              model,
              durationMs: Math.max(0, (this.deps.now ?? Date.now)() - started),
            };
          }
          throw new ClaudeError(
            "request-failed",
            this.safeMessage(
              "errors" in message && message.errors.length
                ? message.errors.join("; ")
                : `Claude finished with "${message.subtype}".`,
            ),
          );
      }
    }
    throw new ClaudeError("request-failed", "Claude ended the session without a result.");
  }

  private options(controller: AbortController, systemPrompt: string): Options {
    return {
      abortController: controller,
      env: subscriptionEnv(this.deps.env),
      // No filesystem settings: no apiKeyHelper, env blocks, hooks, CLAUDE.md or plugins.
      settingSources: [],
      tools: [],
      allowedTools: [],
      mcpServers: {},
      canUseTool: () =>
        Promise.resolve({ behavior: "deny", message: "Tools are disabled for this integration." }),
      maxTurns: 1,
      persistSession: false,
      cwd: (this.deps.workDir ?? defaultWorkDir)(),
      systemPrompt,
      ...(this.deps.config.model ? { model: this.deps.config.model } : {}),
      stderr: (data) => this.deps.log?.(redactSecrets(data.trimEnd(), this.deps.env)),
    };
  }

  private loadSdk(): Promise<AgentSdk> {
    this.sdk ??= this.deps.loadSdk().catch((error: unknown) => {
      this.sdk = undefined;
      throw error;
    });
    return this.sdk;
  }

  private withDeadline<T>(
    promise: Promise<T>,
    ms: number,
    controller: AbortController,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ClaudeError("timeout", "Timed out."));
        }, ms);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  private safeMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return redactSecrets(text, this.deps.env).slice(0, 500);
  }
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("aborted"));
  return new Promise<T>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    promise.then(resolve, reject);
  });
}

export function validateRequest(request: ClaudeRequest): void {
  const { messages } = request;
  if (typeof request.system !== "string" || !Array.isArray(messages) || messages.length === 0) {
    throw new ClaudeError(
      "bad-request",
      "A request needs a system prompt and at least one message.",
    );
  }
  if (messages[0]?.role !== "user" || messages.at(-1)?.role !== "user") {
    throw new ClaudeError(
      "bad-request",
      "The conversation must start and end with a user message.",
    );
  }
}

/**
 * Claude Code sessions take user turns; a single-turn request carries prior
 * exchanges (e.g. a rejected draft and validator feedback) as labelled context.
 */
export function flattenConversation(request: ClaudeRequest): string {
  if (request.messages.length === 1) return request.messages[0]?.content ?? "";
  return request.messages
    .map((m, i) =>
      i === 0
        ? m.content
        : m.role === "assistant"
          ? `--- Your previous response ---\n${m.content}`
          : `--- Follow-up ---\n${m.content}`,
    )
    .join("\n\n");
}

function userMessage(content: string): SDKUserMessage {
  return {
    type: "user",
    message: { role: "user", content },
    parent_tool_use_id: null,
    origin: { kind: "human" },
  };
}

let sharedWorkDir: string | undefined;

/** One empty directory per process, so Claude Code never sees project files. */
function defaultWorkDir(): string {
  sharedWorkDir ??= mkdtempSync(join(tmpdir(), "ccl-claude-"));
  return sharedWorkDir;
}
