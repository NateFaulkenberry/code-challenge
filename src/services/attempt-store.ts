import type { Attempt } from "@/domain/attempt";
import type { ChallengeRepository } from "@/persistence/repository";

export interface AttemptSnapshot {
  status: "loading" | "ready" | "error";
  attempts: readonly Attempt[];
  invalidCount: number;
  error?: string;
}

/**
 * In-memory view of the repository that React subscribes to
 * (useSyncExternalStore). All writes go through here so the UI stays in sync
 * with storage; components never touch the repository directly.
 */
export class AttemptStore {
  private snapshot: AttemptSnapshot = { status: "loading", attempts: [], invalidCount: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(private readonly repository: ChallengeRepository) {}

  get storageKind(): ChallengeRepository["kind"] {
    return this.repository.kind;
  }

  getSnapshot = (): AttemptSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async load(): Promise<void> {
    try {
      const { attempts, invalid } = await this.repository.list();
      this.set({ status: "ready", attempts, invalidCount: invalid.length });
    } catch (error) {
      this.set({
        status: "error",
        attempts: [],
        invalidCount: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  get(id: string): Attempt | undefined {
    return this.snapshot.attempts.find((a) => a.id === id);
  }

  async save(attempt: Attempt): Promise<void> {
    await this.repository.put(attempt);
    const others = this.snapshot.attempts.filter((a) => a.id !== attempt.id);
    this.set({ ...this.snapshot, attempts: [attempt, ...others] });
  }

  async saveMany(attempts: readonly Attempt[]): Promise<void> {
    await this.repository.putMany(attempts);
    const incoming = new Map(attempts.map((a) => [a.id, a]));
    this.set({
      ...this.snapshot,
      attempts: [...attempts, ...this.snapshot.attempts.filter((a) => !incoming.has(a.id))],
    });
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
    this.set({ ...this.snapshot, attempts: this.snapshot.attempts.filter((a) => a.id !== id) });
  }

  async clear(): Promise<void> {
    await this.repository.clear();
    this.set({ ...this.snapshot, attempts: [] });
  }

  private set(snapshot: AttemptSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
