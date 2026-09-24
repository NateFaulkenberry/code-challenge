import { defineFixture } from "./define";

export default defineFixture({
  title: "Request Deduplication Cache",
  language: "typescript",
  difficulty: "advanced",
  category: "async",
  archetype: "caching",
  summary: "Prevent identical concurrent API requests from hitting the network more than once.",
  problemStatement: `Several components on a dashboard request the same resource at the same moment. Each call currently triggers a separate network request.

Implement \`createDeduper(fetcher)\`. It returns a function \`get(key)\` that calls \`fetcher(key)\` **at most once per key while a request for that key is in flight**. Concurrent callers for the same key must receive the *same* promise.`,
  realWorldContext:
    "Data-fetching libraries such as SWR and React Query deduplicate in-flight requests to avoid redundant network traffic.",
  requirements: [
    "Concurrent calls with the same key share one fetcher call and receive the identical Promise object.",
    "Different keys are fetched independently.",
    "Once a request settles (fulfilled or rejected), the next call for that key starts a new request.",
    "A rejected request must not be cached: all concurrent callers observe the rejection, and a later call retries.",
    "Expose `inFlight()` returning how many requests are currently pending.",
  ],
  constraints: ["Do not use timers to expire entries; tie cleanup to promise settlement."],
  starterCode: `export function createDeduper<T>(fetcher: (key: string) => Promise<T>) {
  function get(key: string): Promise<T> {
    return fetcher(key);
  }

  function inFlight(): number {
    return 0;
  }

  return { get, inFlight };
}
`,
  referenceSolution: `export function createDeduper<T>(fetcher: (key: string) => Promise<T>) {
  const pending = new Map<string, Promise<T>>();

  function get(key: string): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing;

    const request = fetcher(key).finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
  }

  function inFlight(): number {
    return pending.size;
  }

  return { get, inFlight };
}
`,
  explanation:
    "Store the in-flight promise in a `Map` keyed by request key. `finally` removes the entry on both success and failure; the identity check guards against removing a newer request for the same key.",
  complexity: { time: "O(1) per call", space: "O(k) for k in-flight keys" },
  tests: {
    prelude: `import { createDeduper } from "./solution";

function deferredFetcher() {
  const calls: string[] = [];
  const resolvers = new Map<string, { resolve: (v: string) => void; reject: (e: Error) => void }>();
  const fetcher = (key: string) => {
    calls.push(key);
    return new Promise<string>((resolve, reject) => resolvers.set(key, { resolve, reject }));
  };
  return { calls, resolvers, fetcher };
}`,
    cases: [
      {
        id: "shares-promise",
        name: "returns the same promise for concurrent calls",
        hidden: false,
        code: `const { fetcher, calls } = deferredFetcher();\nconst { get } = createDeduper(fetcher);\nconst a = get("user:1");\nconst b = get("user:1");\nexpect(a).toBe(b);\nexpect(calls).toEqual(["user:1"]);`,
      },
      {
        id: "independent-keys",
        name: "fetches different keys independently",
        hidden: false,
        code: `const { fetcher, calls } = deferredFetcher();\nconst { get } = createDeduper(fetcher);\nget("a");\nget("b");\nexpect(calls).toEqual(["a", "b"]);`,
      },
      {
        id: "refetch-after-settle",
        name: "starts a new request after the previous one settles",
        hidden: false,
        code: `const { fetcher, calls, resolvers } = deferredFetcher();\nconst { get } = createDeduper(fetcher);\nconst first = get("k");\nresolvers.get("k")!.resolve("v1");\nawait expect(first).resolves.toBe("v1");\nget("k");\nexpect(calls).toEqual(["k", "k"]);`,
      },
      {
        id: "failures-not-cached",
        name: "does not cache failures",
        hidden: true,
        code: `const { fetcher, calls, resolvers } = deferredFetcher();\nconst { get } = createDeduper(fetcher);\nconst a = get("k");\nconst b = get("k");\nresolvers.get("k")!.reject(new Error("boom"));\nawait expect(a).rejects.toThrow("boom");\nawait expect(b).rejects.toThrow("boom");\nget("k");\nexpect(calls).toHaveLength(2);`,
      },
      {
        id: "counts-in-flight",
        name: "reports in-flight requests",
        hidden: true,
        code: `const { fetcher, resolvers } = deferredFetcher();\nconst d = createDeduper(fetcher);\nconst p = d.get("x");\nd.get("x");\nd.get("y");\nexpect(d.inFlight()).toBe(2);\nresolvers.get("x")!.resolve("ok");\nawait p;\nexpect(d.inFlight()).toBe(1);`,
      },
    ],
  },
  expectedConcepts: ["promises", "Map", "in-flight deduplication", "cleanup on settle"],
  estimatedTimeMinutes: 35,
});
