import { describe, expect, it } from "vitest";
import {
  findDuplicate,
  fingerprintChallenge,
  fingerprintSimilarity,
  jaccard,
  tokenize,
} from "./fingerprint";

const base = {
  title: "Request Deduplication Cache",
  problemStatement:
    "Prevent identical concurrent API requests from executing multiple times by sharing in-flight promises.",
  requirements: ["Concurrent calls share one promise", "Failures are not cached"],
  archetype: "caching" as const,
  language: "typescript" as const,
};

describe("fingerprint", () => {
  it("normalizes tokens (case, punctuation, stop words, plurals)", () => {
    expect(tokenize("The Requests, deduplicated!")).toEqual(["request", "deduplicat"]);
  });

  it("is stable and order-insensitive for the body", () => {
    expect(fingerprintChallenge(base)).toBe(
      fingerprintChallenge({ ...base, requirements: [...base.requirements].reverse() }),
    );
  });

  it("flags a lightly reworded challenge as a duplicate", () => {
    const original = fingerprintChallenge(base);
    const reworded = fingerprintChallenge({
      ...base,
      title: "Deduplicating Request Cache",
      problemStatement:
        "Prevent identical concurrent API requests from executing more than once by sharing the in-flight promise.",
    });
    expect(fingerprintSimilarity(original, reworded)).toBeGreaterThan(0.6);
    expect(
      findDuplicate(reworded, [{ id: "a", title: base.title, fingerprint: original }])?.id,
    ).toBe("a");
  });

  it("does not flag a different challenge", () => {
    const other = fingerprintChallenge({
      title: "Ring Buffer",
      problemStatement:
        "Implement a bounded circular buffer for audio samples with overwrite semantics.",
      requirements: ["Reject writes when full", "Read in FIFO order"],
      archetype: "data-structure",
      language: "c",
    });
    expect(
      findDuplicate(other, [
        { id: "a", title: base.title, fingerprint: fingerprintChallenge(base) },
      ]),
    ).toBeUndefined();
  });

  it("computes Jaccard similarity", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBe(1);
  });
});
