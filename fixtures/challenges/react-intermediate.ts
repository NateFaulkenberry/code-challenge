import { defineFixture } from "./define";

export default defineFixture({
  title: "Debounced User Search",
  language: "react",
  difficulty: "intermediate",
  category: "react",
  archetype: "ui-component",
  summary:
    "Build a search box that debounces requests, shows loading/error/empty states and never lets a stale response win.",
  problemStatement: `The admin console needs a user search. Every keystroke currently hits the API, results flicker, and a slow response for an old query sometimes overwrites the results for the newest one.

Build \`UserSearch\`, the default export of \`solution.tsx\`. It receives an async \`search(query)\` function and a \`debounceMs\` delay as props (both optional — defaults are provided in the starter).`,
  realWorldContext:
    "Search-as-you-type is everywhere; debouncing and race-condition handling are the difference between a snappy UI and a flickering, wrong one.",
  requirements: [
    'Render a search input (`type="search"`) with the accessible name **Search users**.',
    "Call `search` only after the user has stopped typing for `debounceMs`, with the trimmed query. Never call it for an empty query.",
    'While a search is pending, show `Loading…` in an element with `role="status"`.',
    "Render results as a list (`<ul>` of `<li>`). If there are none, show the text **No users found**.",
    'If `search` rejects, show `Search failed: <message>` in an element with `role="alert"`.',
    "A response for an older query must never replace the results of a newer one.",
    "Clearing the input clears results, loading and error states.",
  ],
  constraints: [
    "Use React hooks only — no external libraries.",
    "Do not call `search` from render.",
  ],
  starterCode: `import { useState } from "react";

const USERS = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Linus Torvalds", "Margaret Hamilton"];

async function defaultSearch(query: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return USERS.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
}

interface Props {
  search?: (query: string) => Promise<string[]>;
  debounceMs?: number;
}

export default function UserSearch({ search = defaultSearch, debounceMs = 250 }: Props) {
  const [query, setQuery] = useState("");
  // TODO: debounce, call search, and render loading / results / empty / error states.
  void search;
  void debounceMs;
  return <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />;
}
`,
  referenceSolution: `import { useEffect, useState } from "react";

const USERS = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Linus Torvalds", "Margaret Hamilton"];

async function defaultSearch(query: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return USERS.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
}

interface Props {
  search?: (query: string) => Promise<string[]>;
  debounceMs?: number;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; results: string[] }
  | { status: "error"; message: string };

export default function UserSearch({ search = defaultSearch, debounceMs = 250 }: Props) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setState({ status: "idle" });
      return;
    }
    // Each effect run owns its request; cleanup marks it stale.
    let stale = false;
    const timer = setTimeout(() => {
      setState({ status: "loading" });
      search(trimmed).then(
        (results) => {
          if (!stale) setState({ status: "success", results });
        },
        (error: unknown) => {
          if (!stale) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
        },
      );
    }, debounceMs);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, search, debounceMs]);

  return (
    <div>
      <input
        type="search"
        aria-label="Search users"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {state.status === "loading" && <p role="status">Loading…</p>}
      {state.status === "error" && <p role="alert">Search failed: {state.message}</p>}
      {state.status === "success" &&
        (state.results.length === 0 ? (
          <p>No users found</p>
        ) : (
          <ul>
            {state.results.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ))}
    </div>
  );
}
`,
  explanation:
    "A single effect keyed on the query does three jobs: it debounces with `setTimeout`, starts the request when the timer fires, and — through its cleanup — both cancels a pending timer and marks any in-flight request as stale. Because every keystroke re-runs the effect, a response can only update state if its effect is still the current one, which makes out-of-order responses harmless. A discriminated union keeps loading, error, empty and result states mutually exclusive.",
  complexity: { time: "O(1) work per keystroke", space: "O(r) for r results" },
  tests: {
    prelude: `import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserSearch from "./solution";`,
    cases: [
      {
        id: "labelled-searchbox",
        name: "renders a labelled search box",
        hidden: false,
        code: `render(<UserSearch search={async () => []} debounceMs={20} />);\nexpect(screen.getByRole("searchbox", { name: /search users/i })).toBeInTheDocument();`,
      },
      {
        id: "debounces",
        name: "debounces typing into a single search call",
        hidden: false,
        code: `const search = fn(async (q: string) => [q]);\nconst user = userEvent.setup();\nrender(<UserSearch search={search as never} debounceMs={60} />);\nawait user.type(screen.getByRole("searchbox"), "ada");\nawait sleep(150);\nexpect(search).toHaveBeenCalledTimes(1);\nexpect(search).toHaveBeenCalledWith("ada");`,
      },
      {
        id: "shows-results",
        name: "shows results as a list",
        hidden: false,
        code: `const user = userEvent.setup();\nrender(<UserSearch search={async () => ["Ada Lovelace", "Alan Turing"]} debounceMs={20} />);\nawait user.type(screen.getByRole("searchbox"), "a");\nexpect(await screen.findByText("Alan Turing")).toBeInTheDocument();\nexpect(screen.getAllByRole("listitem")).toHaveLength(2);`,
      },
      {
        id: "empty-state",
        name: "shows an empty state",
        hidden: false,
        code: `const user = userEvent.setup();\nrender(<UserSearch search={async () => []} debounceMs={20} />);\nawait user.type(screen.getByRole("searchbox"), "zz");\nexpect(await screen.findByText("No users found")).toBeInTheDocument();`,
      },
      {
        id: "loading-state",
        name: "shows a loading status while pending",
        hidden: false,
        code: `const user = userEvent.setup();\nrender(<UserSearch search={() => new Promise(() => {})} debounceMs={20} />);\nawait user.type(screen.getByRole("searchbox"), "a");\nexpect(await screen.findByRole("status")).toHaveTextContent("Loading");`,
      },
      {
        id: "error-state",
        name: "shows an alert when the search fails",
        hidden: true,
        code: `const user = userEvent.setup();\nrender(<UserSearch search={async () => { throw new Error("offline"); }} debounceMs={20} />);\nawait user.type(screen.getByRole("searchbox"), "a");\nexpect(await screen.findByRole("alert")).toHaveTextContent("Search failed: offline");`,
      },
      {
        id: "ignores-stale",
        name: "ignores responses for older queries",
        hidden: true,
        code: `const resolvers = new Map<string, (value: string[]) => void>();\nconst search = (q: string) => new Promise<string[]>((resolve) => resolvers.set(q, resolve));\nconst user = userEvent.setup();\nrender(<UserSearch search={search} debounceMs={20} />);\nconst box = screen.getByRole("searchbox");\nawait user.type(box, "a");\nawait waitFor(() => expect(resolvers.has("a")).toBe(true));\nawait user.type(box, "b");\nawait waitFor(() => expect(resolvers.has("ab")).toBe(true));\nawait act(async () => resolvers.get("ab")!(["newest"]));\nexpect(await screen.findByText("newest")).toBeInTheDocument();\nawait act(async () => resolvers.get("a")!(["stale"]));\nawait sleep(20);\nexpect(screen.queryByText("stale")).toBeNull();\nexpect(screen.getByText("newest")).toBeInTheDocument();`,
      },
      {
        id: "clears",
        name: "clears results when the input is cleared",
        hidden: true,
        code: `const user = userEvent.setup();\nrender(<UserSearch search={async () => ["Grace Hopper"]} debounceMs={20} />);\nconst box = screen.getByRole("searchbox");\nawait user.type(box, "g");\nawait screen.findByText("Grace Hopper");\nawait user.clear(box);\nawait sleep(60);\nexpect(screen.queryByText("Grace Hopper")).toBeNull();\nexpect(screen.queryByRole("status")).toBeNull();`,
      },
      {
        id: "no-empty-search",
        name: "never searches for a blank query",
        hidden: true,
        code: `const search = fn(async () => []);\nconst user = userEvent.setup();\nrender(<UserSearch search={search as never} debounceMs={20} />);\nawait user.type(screen.getByRole("searchbox"), "   ");\nawait sleep(80);\nexpect(search).toHaveBeenCalledTimes(0);`,
      },
    ],
  },
  expectedConcepts: [
    "useEffect cleanup",
    "debouncing",
    "race conditions",
    "discriminated unions",
    "accessible roles",
  ],
  estimatedTimeMinutes: 30,
});
