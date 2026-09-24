import type { Attempt } from "@/domain/attempt";
import type { ChallengeRepository, LoadResult } from "./repository";

/** Used in tests and as a session-only fallback when IndexedDB is unavailable. */
export class MemoryRepository implements ChallengeRepository {
  readonly kind = "memory" as const;
  private readonly records = new Map<string, Attempt>();

  constructor(initial: readonly Attempt[] = []) {
    initial.forEach((a) => this.records.set(a.id, structuredClone(a)));
  }

  list(): Promise<LoadResult> {
    return Promise.resolve({
      attempts: [...this.records.values()].map((a) => structuredClone(a)),
      invalid: [],
    });
  }

  get(id: string): Promise<Attempt | undefined> {
    const record = this.records.get(id);
    return Promise.resolve(record && structuredClone(record));
  }

  put(attempt: Attempt): Promise<void> {
    this.records.set(attempt.id, structuredClone(attempt));
    return Promise.resolve();
  }

  async putMany(attempts: readonly Attempt[]): Promise<void> {
    for (const attempt of attempts) await this.put(attempt);
  }

  delete(id: string): Promise<void> {
    this.records.delete(id);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.records.clear();
    return Promise.resolve();
  }
}
