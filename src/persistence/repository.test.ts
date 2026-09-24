import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import tsAdvanced from "../../fixtures/challenges/typescript-advanced";
import { at, makeChallenge, passedAttempt } from "../../tests/helpers/factories";
import { createAttempt } from "@/domain/attempt";
import { IndexedDbRepository } from "./indexeddb-repository";
import { MemoryRepository } from "./memory-repository";
import type { ChallengeRepository } from "./repository";

const implementations: [string, () => Promise<ChallengeRepository>][] = [
  ["memory", () => Promise.resolve(new MemoryRepository())],
  ["indexeddb", () => IndexedDbRepository.open(`test-${crypto.randomUUID()}`)],
];

describe.each(implementations)("%s repository", (_name, open) => {
  const a = createAttempt(makeChallenge(), at(0));
  const b = passedAttempt(tsAdvanced, at(1));

  it("puts, gets and lists attempts", async () => {
    const repo = await open();
    await repo.put(a);
    await repo.putMany([b]);
    expect(await repo.get(a.id)).toEqual(a);
    expect((await repo.list()).attempts.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("overwrites by id, deletes and clears", async () => {
    const repo = await open();
    await repo.put(a);
    await repo.put({ ...a, solution: "changed" });
    expect((await repo.get(a.id))?.solution).toBe("changed");
    await repo.delete(a.id);
    expect(await repo.get(a.id)).toBeUndefined();
    await repo.put(b);
    await repo.clear();
    expect((await repo.list()).attempts).toEqual([]);
  });

  it("returns copies, not live references", async () => {
    const repo = await open();
    await repo.put(a);
    const loaded = await repo.get(a.id);
    loaded!.solution = "mutated";
    expect((await repo.get(a.id))?.solution).toBe(a.solution);
  });
});

describe("IndexedDbRepository validation", () => {
  it("quarantines corrupt records instead of failing the whole list", async () => {
    const name = "corrupt";
    const repo = await IndexedDbRepository.open(name);
    await repo.put(createAttempt(makeChallenge(), at(0)));
    repo.close();

    // Write a corrupt row behind the repository's back.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onsuccess = () => {
        const tx = request.result.transaction("attempts", "readwrite");
        tx.objectStore("attempts").put({ id: "broken", status: "passed" });
        tx.oncomplete = () => {
          request.result.close();
          resolve();
        };
        tx.onerror = () => reject(new Error(String(tx.error)));
      };
    });

    const reopened = await IndexedDbRepository.open(name);
    const result = await reopened.list();
    expect(result.attempts).toHaveLength(1);
    expect(result.invalid).toEqual([expect.objectContaining({ id: "broken" })]);
  });

  it("refuses to write invalid attempts", async () => {
    const repo = await IndexedDbRepository.open("invalid-write");
    await expect(repo.put({ id: "x" } as never)).rejects.toThrow();
  });
});
