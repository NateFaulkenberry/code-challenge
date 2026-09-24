import type { Attempt } from "@/domain/attempt";

export interface LoadResult {
  attempts: Attempt[];
  /** Records that failed validation. They are left untouched in storage and reported. */
  invalid: { id: string; reason: string }[];
}

/**
 * Persistence boundary for challenge history. UI and services depend on this
 * interface only; IndexedDB is an implementation detail.
 */
export interface ChallengeRepository {
  readonly kind: "indexeddb" | "memory";
  list(): Promise<LoadResult>;
  get(id: string): Promise<Attempt | undefined>;
  put(attempt: Attempt): Promise<void>;
  putMany(attempts: readonly Attempt[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageError";
  }
}
