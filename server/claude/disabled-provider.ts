import type { ClaudeConfig } from "./config.ts";
import {
  ClaudeError,
  type ClaudeProvider,
  type ClaudeResponse,
  type ClaudeStatus,
} from "./types.ts";

/** Used whenever local Claude isn't explicitly enabled (the default). */
export class DisabledClaudeProvider implements ClaudeProvider {
  readonly kind = "disabled" as const;
  private readonly problems: string[];

  constructor(config: Pick<ClaudeConfig, "problems">) {
    this.problems = config.problems;
  }

  status(): Promise<ClaudeStatus> {
    return Promise.resolve({
      provider: "disabled",
      state: this.problems.length ? "misconfigured" : "disabled",
      authentication: "none",
      message: this.problems.length
        ? this.problems.join(" ")
        : "Local Claude is disabled. Start the dev server with `npm run dev:claude` (CLAUDE_PROVIDER=subscription) to enable it.",
    });
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }

  run(): Promise<ClaudeResponse> {
    return Promise.reject(new ClaudeError("disabled", "Local Claude is disabled."));
  }
}
