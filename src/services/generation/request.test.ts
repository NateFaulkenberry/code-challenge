import { describe, expect, it } from "vitest";
import { pickFresh, resolveRequest } from "./request";

function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe("resolveRequest", () => {
  it("keeps explicit parameters", () => {
    const resolved = resolveRequest(
      { language: "typescript", difficulty: "expert", category: "async", archetype: "caching" },
      { availableLanguages: ["typescript"], history: [] },
    );
    expect(resolved).toEqual({
      language: "typescript",
      difficulty: "expert",
      category: "async",
      archetype: "caching",
    });
  });

  it("only picks available languages and affinity-compatible taxonomy", () => {
    for (let i = 0; i < 50; i++) {
      const resolved = resolveRequest({}, { availableLanguages: ["react"], history: [] });
      expect(resolved.language).toBe("react");
      expect([
        "frontend",
        "react",
        "state-management",
        "async",
        "performance",
        "debugging",
      ]).toContain(resolved.category);
    }
  });

  it("throws when nothing is available", () => {
    expect(() => resolveRequest({}, { availableLanguages: [], history: [] })).toThrow();
  });
});

describe("pickFresh", () => {
  it("steers away from recently used items", () => {
    const counts = { a: 0, b: 0 };
    const random = sequence(...Array.from({ length: 1000 }, (_, i) => i / 1000));
    for (let i = 0; i < 1000; i++)
      counts[pickFresh(["a", "b"] as const, (x) => (x === "a" ? 9 : 0), random)]++;
    // weights 0.1 vs 1 → roughly 9% vs 91%
    expect(counts.a).toBeLessThan(150);
    expect(counts.b).toBeGreaterThan(850);
  });
});
