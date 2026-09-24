import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { AttemptSchema, type Attempt } from "@/domain/attempt";
import { StorageError, type ChallengeRepository, type LoadResult } from "./repository";

export const DB_NAME = "coding-challenge-lab";
export const DB_VERSION = 1;

interface LabDB extends DBSchema {
  attempts: {
    key: string;
    value: unknown;
    indexes: { status: string; language: string; updatedAt: string };
  };
}

/**
 * Migrations run in order from the stored version to DB_VERSION. Each step
 * must be idempotent with respect to the stores it creates.
 */
const migrations: Record<number, (db: IDBPDatabase<LabDB>) => void> = {
  1: (db) => {
    const store = db.createObjectStore("attempts", { keyPath: "id" });
    store.createIndex("status", "status");
    store.createIndex("language", "challenge.language");
    store.createIndex("updatedAt", "updatedAt");
  },
};

export class IndexedDbRepository implements ChallengeRepository {
  readonly kind = "indexeddb" as const;

  private constructor(private readonly db: IDBPDatabase<LabDB>) {}

  static async open(name = DB_NAME): Promise<IndexedDbRepository> {
    if (typeof globalThis.indexedDB === "undefined")
      throw new StorageError("IndexedDB is not available in this browser.");
    try {
      const db = await openDB<LabDB>(name, DB_VERSION, {
        upgrade(database, oldVersion) {
          for (let version = oldVersion + 1; version <= DB_VERSION; version++)
            migrations[version]?.(database);
        },
        blocked() {
          console.warn("Database upgrade is blocked by another open tab.");
        },
      });
      return new IndexedDbRepository(db);
    } catch (error) {
      throw new StorageError("Could not open local storage (IndexedDB).", { cause: error });
    }
  }

  async list(): Promise<LoadResult> {
    const rows = await this.wrap(() => this.db.getAll("attempts"));
    const result: LoadResult = { attempts: [], invalid: [] };
    for (const row of rows) {
      const parsed = AttemptSchema.safeParse(row);
      if (parsed.success) result.attempts.push(parsed.data);
      else {
        const id =
          typeof row === "object" && row !== null && "id" in row ? String(row.id) : "(unknown)";
        result.invalid.push({ id, reason: parsed.error.issues[0]?.message ?? "Invalid record" });
      }
    }
    return result;
  }

  async get(id: string): Promise<Attempt | undefined> {
    const row = await this.wrap(() => this.db.get("attempts", id));
    if (row === undefined) return undefined;
    const parsed = AttemptSchema.safeParse(row);
    return parsed.success ? parsed.data : undefined;
  }

  async put(attempt: Attempt): Promise<void> {
    await this.wrap(() => this.db.put("attempts", AttemptSchema.parse(attempt)));
  }

  async putMany(attempts: readonly Attempt[]): Promise<void> {
    const validated = attempts.map((a) => AttemptSchema.parse(a));
    await this.wrap(async () => {
      const tx = this.db.transaction("attempts", "readwrite");
      await Promise.all([...validated.map((a) => tx.store.put(a)), tx.done]);
    });
  }

  async delete(id: string): Promise<void> {
    await this.wrap(() => this.db.delete("attempts", id));
  }

  async clear(): Promise<void> {
    await this.wrap(() => this.db.clear("attempts"));
  }

  close(): void {
    this.db.close();
  }

  private async wrap<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const quota = error instanceof DOMException && error.name === "QuotaExceededError";
      throw new StorageError(
        quota
          ? "Local storage is full. Export and remove old challenges to free space."
          : "A local storage operation failed.",
        { cause: error },
      );
    }
  }
}

/** Opens IndexedDB, falling back to session-only memory storage (e.g. private browsing). */
export async function openRepository(): Promise<{
  repository: ChallengeRepository;
  warning?: string;
}> {
  try {
    return { repository: await IndexedDbRepository.open() };
  } catch (error) {
    const { MemoryRepository } = await import("./memory-repository");
    return {
      repository: new MemoryRepository(),
      warning: `${error instanceof Error ? error.message : "Storage unavailable."} Your work will only be kept until this tab is closed.`,
    };
  }
}
