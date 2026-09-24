import type { LanguageId } from "@/domain/languages";
import type { InitProgress, LanguageRuntime } from "@/runtimes/core/types";
import type { RuntimeLoader } from "@/runtimes/registry";

export type RuntimeState =
  | { phase: "idle" }
  | { phase: "loading"; progress?: InitProgress }
  | { phase: "ready" }
  | { phase: "unsupported"; reason: string }
  | { phase: "error"; message: string };

type Listener = (language: LanguageId, state: RuntimeState) => void;

/** Stable object so useSyncExternalStore sees an unchanged snapshot. */
const IDLE: RuntimeState = { phase: "idle" };

/**
 * Owns runtime instances for the app: lazy creation, one instance per
 * language, and observable status for the UI.
 */
export class ExecutionService {
  private readonly runtimes = new Map<LanguageId, Promise<LanguageRuntime>>();
  private readonly states = new Map<LanguageId, RuntimeState>();
  private readonly listeners = new Set<Listener>();

  constructor(private readonly loaders: Readonly<Record<LanguageId, RuntimeLoader>>) {}

  state(language: LanguageId): RuntimeState {
    return this.states.get(language) ?? IDLE;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Loads (once) and initializes the runtime. Never throws for runtime failures — they're reflected in state. */
  async prepare(language: LanguageId): Promise<LanguageRuntime> {
    const runtime = await this.instance(language);
    const support = runtime.isSupported();
    if (!support.supported) {
      this.setState(language, { phase: "unsupported", reason: support.reason });
      return runtime;
    }
    if (this.state(language).phase !== "ready") {
      this.setState(language, { phase: "loading" });
      try {
        await runtime.initialize((progress) =>
          this.setState(language, { phase: "loading", progress }),
        );
        this.setState(language, { phase: "ready" });
      } catch (error) {
        this.setState(language, {
          phase: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return runtime;
  }

  disposeAll(): void {
    for (const pending of this.runtimes.values()) void pending.then((r) => r.dispose());
    this.runtimes.clear();
    this.states.clear();
  }

  /** The runtime instance without initializing it (e.g. to attach a preview first). */
  instance(language: LanguageId): Promise<LanguageRuntime> {
    let runtime = this.runtimes.get(language);
    if (!runtime) {
      runtime = this.loaders[language]();
      this.runtimes.set(language, runtime);
      runtime.catch(() => this.runtimes.delete(language));
    }
    return runtime;
  }

  private setState(language: LanguageId, state: RuntimeState): void {
    this.states.set(language, state);
    this.listeners.forEach((listener) => listener(language, state));
  }
}
