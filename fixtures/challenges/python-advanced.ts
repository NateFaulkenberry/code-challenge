import { defineFixture } from "./define";

export default defineFixture({
  title: "Endpoint Latency Report",
  language: "python",
  difficulty: "advanced",
  category: "parsing",
  archetype: "data-transformation",
  summary:
    "Parse access-log lines, group requests by endpoint, and report latency percentiles while tolerating malformed input.",
  problemStatement: `An on-call engineer wants a quick latency breakdown from raw access logs. Each line looks like:

\`\`\`
2026-09-20T12:00:01Z GET /api/users/42 200 123ms
\`\`\`

Implement \`latency_report(lines)\`, returning a dict keyed by **normalized endpoint** (\`"GET /api/users/:id"\`) with the request count and the p50, p95 and p99 latencies in milliseconds.`,
  realWorldContext:
    "Percentile latency per route is the first thing SREs look at during an incident; averages hide the slow tail.",
  requirements: [
    "Normalize numeric path segments to `:id` and include the HTTP method: `GET /api/users/42` → `GET /api/users/:id`.",
    "Ignore the query string (`/search?q=x` → `/search`).",
    'Skip malformed lines (wrong field count, non-numeric latency, missing `ms` suffix) and count them under the key `"_malformed"` as an int.',
    "Compute percentiles with the **nearest-rank** method: the value at rank ⌈p/100 × n⌉ of the sorted latencies.",
    'Each endpoint maps to `{"count": int, "p50": int, "p95": int, "p99": int}`.',
    'Return `{"_malformed": 0}` for empty input.',
  ],
  constraints: ["Standard library only.", "Must handle 100,000 lines in well under a second."],
  starterCode: `def latency_report(lines):
    """Return per-endpoint request counts and p50/p95/p99 latencies."""
    report = {"_malformed": 0}
    # TODO: parse, normalize, group and compute percentiles
    return report
`,
  referenceSolution: `import math
import re
from collections import defaultdict

_NUMERIC = re.compile(r"^\\d+$")


def _normalize(method, path):
    path = path.split("?", 1)[0]
    segments = [":id" if _NUMERIC.match(s) else s for s in path.split("/")]
    return f"{method} {'/'.join(segments)}"


def _nearest_rank(sorted_values, p):
    rank = max(1, math.ceil(p / 100 * len(sorted_values)))
    return sorted_values[rank - 1]


def latency_report(lines):
    """Return per-endpoint request counts and p50/p95/p99 latencies."""
    latencies = defaultdict(list)
    malformed = 0
    for line in lines:
        parts = line.split()
        if len(parts) != 5 or not parts[4].endswith("ms"):
            malformed += 1
            continue
        _, method, path, _status, latency = parts
        try:
            value = int(latency[:-2])
        except ValueError:
            malformed += 1
            continue
        latencies[_normalize(method, path)].append(value)

    report = {"_malformed": malformed}
    for endpoint, values in latencies.items():
        values.sort()
        report[endpoint] = {
            "count": len(values),
            "p50": _nearest_rank(values, 50),
            "p95": _nearest_rank(values, 95),
            "p99": _nearest_rank(values, 99),
        }
    return report
`,
  explanation:
    "A single pass groups latencies per normalized endpoint in a `defaultdict(list)`, counting malformed lines as it goes. Sorting each group once makes every percentile an O(1) index using the nearest-rank formula `ceil(p/100 * n)`. Normalization splits off the query string and replaces purely numeric segments.",
  complexity: { time: "O(n log n)", space: "O(n)" },
  tests: {
    prelude: `from solution import latency_report`,
    cases: [
      {
        id: "empty-input",
        name: "returns only the malformed counter for empty input",
        hidden: false,
        code: `assert latency_report([]) == {"_malformed": 0}`,
      },
      {
        id: "normalizes-ids",
        name: "normalizes numeric segments and keeps the method",
        hidden: false,
        code: `report = latency_report([\n    "2026-09-20T12:00:01Z GET /api/users/42 200 100ms",\n    "2026-09-20T12:00:02Z GET /api/users/7 200 300ms",\n])\nassert set(report) == {"_malformed", "GET /api/users/:id"}\nassert report["GET /api/users/:id"]["count"] == 2`,
      },
      {
        id: "nearest-rank",
        name: "computes nearest-rank percentiles",
        hidden: false,
        code: `lines = [f"t GET /a 200 {v}ms" for v in range(1, 101)]\nstats = latency_report(lines)["GET /a"]\nassert stats == {"count": 100, "p50": 50, "p95": 95, "p99": 99}`,
      },
      {
        id: "counts-malformed",
        name: "skips and counts malformed lines",
        hidden: false,
        code: `report = latency_report(["garbage", "t GET /a 200 12", "t GET /a 200 xms", "t GET /a 200 5ms"])\nassert report["_malformed"] == 3\nassert report["GET /a"]["count"] == 1`,
      },
      {
        id: "query-string",
        name: "ignores query strings",
        hidden: true,
        code: `report = latency_report(["t GET /search?q=x 200 5ms", "t GET /search 200 7ms"])\nassert report["GET /search"]["count"] == 2`,
      },
      {
        id: "methods-separate",
        name: "keeps methods separate",
        hidden: true,
        code: `report = latency_report(["t GET /a/1 200 5ms", "t POST /a/1 201 9ms"])\nassert report["GET /a/:id"]["count"] == 1\nassert report["POST /a/:id"]["p99"] == 9`,
      },
      {
        id: "single-value",
        name: "handles a single sample",
        hidden: true,
        code: `assert latency_report(["t GET /x 200 42ms"])["GET /x"] == {"count": 1, "p50": 42, "p95": 42, "p99": 42}`,
      },
      {
        id: "performance",
        name: "handles 100k lines quickly",
        hidden: true,
        code: `import time\nlines = [f"t GET /api/items/{i % 50} 200 {i % 997}ms" for i in range(100_000)]\nstart = time.perf_counter()\nreport = latency_report(lines)\nassert report["GET /api/items/:id"]["count"] == 100_000\nassert time.perf_counter() - start < 2.0`,
      },
    ],
  },
  expectedConcepts: [
    "parsing",
    "defaultdict",
    "percentiles",
    "regular expressions",
    "defensive input handling",
  ],
  estimatedTimeMinutes: 40,
});
