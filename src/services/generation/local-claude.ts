import { assetUrl } from "@/utils/asset-url";
import {
  ProviderError,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type ProviderStatus,
} from "./provider";

/**
 * Local Claude (Claude Agent SDK + the developer's Claude subscription).
 *
 * The browser never sees credentials: it only calls same-origin endpoints on
 * the local Vite dev server (server/claude), which runs the Agent SDK.
 * Everything here is gated on `import.meta.env.DEV`, so production builds —
 * the public GitHub Pages site — contain none of it (verified by
 * scripts/check-bundle.mjs).
 */
export const LOCAL_CLAUDE_SUPPORTED: boolean = import.meta.env.DEV;

export const LOCAL_CLAUDE_LABEL = "Claude — Local Only";

/** Mirror of the server's ClaudeStatus (server/claude/types.ts). */
export interface LocalClaudeStatus {
  provider: "disabled" | "subscription";
  state: "disabled" | "ready" | "unauthenticated" | "api-key-in-use" | "misconfigured" | "error";
  authentication: "claude-subscription" | "none";
  subscription?: string;
  message: string;
}

export type LocalClaudeAvailability =
  | { kind: "unsupported" } // production / public build
  | { kind: "checking" }
  | { kind: "unreachable"; message: string }
  | { kind: "known"; status: LocalClaudeStatus };

const endpoint = (path: "status" | "generate") => assetUrl(`__local/claude/${path}`);

export async function fetchLocalClaudeStatus(
  fetchImpl: typeof fetch = fetch,
): Promise<LocalClaudeAvailability> {
  if (!LOCAL_CLAUDE_SUPPORTED) return { kind: "unsupported" };
  try {
    const response = await fetchImpl(endpoint("status"), {
      headers: { accept: "application/json" },
    });
    if (!response.ok)
      return { kind: "unreachable", message: `The local server answered HTTP ${response.status}.` };
    return { kind: "known", status: (await response.json()) as LocalClaudeStatus };
  } catch {
    return { kind: "unreachable", message: "The local dev server is not reachable." };
  }
}

/** Observable status for the UI (useSyncExternalStore). */
export class LocalClaudeStatusStore {
  private snapshot: LocalClaudeAvailability = LOCAL_CLAUDE_SUPPORTED
    ? { kind: "checking" }
    : { kind: "unsupported" };
  private readonly listeners = new Set<() => void>();

  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  getSnapshot = (): LocalClaudeAvailability => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async refresh(): Promise<LocalClaudeAvailability> {
    if (!LOCAL_CLAUDE_SUPPORTED) return this.snapshot;
    this.snapshot = await fetchLocalClaudeStatus(this.fetchImpl);
    this.listeners.forEach((l) => l());
    return this.snapshot;
  }
}

export function localClaudeProviderStatus(availability: LocalClaudeAvailability): ProviderStatus {
  if (availability.kind === "known" && availability.status.state === "ready") {
    return {
      state: "ready",
      label: `${LOCAL_CLAUDE_LABEL} · ${availability.status.subscription ?? "subscription"}`,
    };
  }
  const reason =
    availability.kind === "unsupported"
      ? "Local Claude is only available when running the app locally."
      : availability.kind === "checking"
        ? "Checking the local Claude integration…"
        : availability.kind === "unreachable"
          ? availability.message
          : availability.status.message;
  return { state: "needs-configuration", label: LOCAL_CLAUDE_LABEL, reason };
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

/** Generation provider backed by the local dev server's Claude endpoint. */
export class LocalClaudeProvider implements LlmProvider {
  readonly id = "claude-local" as const;

  constructor(
    private readonly availability: () => LocalClaudeAvailability,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  status(): ProviderStatus {
    return localClaudeProviderStatus(this.availability());
  }

  async generate(request: LlmRequest, signal: AbortSignal): Promise<LlmResponse> {
    if (!LOCAL_CLAUDE_SUPPORTED)
      throw new ProviderError("bad-request", "Local Claude is not available in this build.");
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint("generate"), {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system: request.prompt.system,
          messages: [{ role: "user", content: request.prompt.user }, ...request.history],
        }),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ProviderError("network", "The local dev server is not reachable.", String(error));
    }
    const payload = (await response.json().catch(() => ({}))) as Partial<LlmResponse> & ErrorBody;
    if (!response.ok) {
      const message = payload.error?.message ?? `Local Claude failed (HTTP ${response.status}).`;
      const kind =
        response.status === 401 || response.status === 409
          ? "auth"
          : response.status === 429
            ? "rate-limit"
            : response.status === 400 || response.status === 503
              ? "bad-request"
              : "unknown";
      throw new ProviderError(kind, message, payload.error?.code);
    }
    if (typeof payload.text !== "string")
      throw new ProviderError("unknown", "Local Claude returned an invalid response.");
    return {
      text: payload.text,
      model: typeof payload.model === "string" ? payload.model : "claude",
    };
  }
}
