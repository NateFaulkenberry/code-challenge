/**
 * Local Claude integration — shared types.
 *
 * Node-only: this directory runs inside the local Vite dev server (and the
 * claude:* scripts). It is never imported by browser code and never part of
 * the production build. Written as erasable-only TypeScript so the scripts can
 * run under Node's built-in type stripping.
 */

export type ClaudeProviderKind = "disabled" | "subscription";

/** Only shape that ever leaves this module toward the browser: no secrets, no email. */
export interface ClaudeStatus {
  provider: ClaudeProviderKind;
  state: "disabled" | "ready" | "unauthenticated" | "api-key-in-use" | "misconfigured" | "error";
  authentication: "claude-subscription" | "none";
  /** Plan name reported by Claude Code, e.g. "Claude Max". */
  subscription?: string;
  /** Human-readable, actionable explanation. */
  message: string;
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeRequest {
  system: string;
  /** Conversation so far; must start and end with a user message. */
  messages: ClaudeMessage[];
}

export interface ClaudeResponse {
  text: string;
  model: string;
  durationMs: number;
}

export interface ClaudeProvider {
  readonly kind: ClaudeProviderKind;
  status(): Promise<ClaudeStatus>;
  isAvailable(): Promise<boolean>;
  run(request: ClaudeRequest, signal?: AbortSignal): Promise<ClaudeResponse>;
}

export type ClaudeErrorCode =
  | "disabled"
  | "unauthenticated"
  | "api-key-in-use"
  | "sdk-unavailable"
  | "timeout"
  | "cancelled"
  | "rate-limited"
  | "request-failed"
  | "bad-request";

export class ClaudeError extends Error {
  readonly code: ClaudeErrorCode;

  constructor(code: ClaudeErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ClaudeError";
    this.code = code;
  }
}
