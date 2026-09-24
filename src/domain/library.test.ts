import { describe, expect, it } from "vitest";
import tsAdvanced from "../../fixtures/challenges/typescript-advanced";
import { at, makeChallenge, passedAttempt } from "../../tests/helpers/factories";
import { createAttempt, updateSolution } from "./attempt";
import { DEFAULT_LIBRARY_QUERY, queryFromParams, queryLibrary, queryToParams } from "./library";

const beginner = passedAttempt(makeChallenge(), at(10));
const advanced = passedAttempt(tsAdvanced, at(20));
const python = passedAttempt(
  makeChallenge({
    id: "py",
    title: "Log Analyzer",
    language: "python",
    category: "parsing",
    difficulty: "intermediate",
  }),
  at(5),
);
const draft = updateSolution(
  createAttempt(makeChallenge({ id: "draft", title: "Zebra Draft" }), at(0)),
  "wip",
  at(30),
);
const all = [beginner, advanced, python, draft];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("queryLibrary", () => {
  it("sorts newest first by default using completion/activity date", () => {
    expect(ids(queryLibrary(all, DEFAULT_LIBRARY_QUERY))).toEqual([
      draft.id,
      advanced.id,
      beginner.id,
      python.id,
    ]);
  });

  it("sorts by oldest, difficulty, language and title", () => {
    const q = DEFAULT_LIBRARY_QUERY;
    expect(ids(queryLibrary(all, { ...q, sort: "oldest" }))[0]).toBe(python.id);
    expect(ids(queryLibrary(all, { ...q, sort: "difficulty" }))[0]).toBe(advanced.id);
    expect(ids(queryLibrary(all, { ...q, sort: "language" }))[0]).toBe(python.id);
    expect(ids(queryLibrary(all, { ...q, sort: "title" }))).toEqual([
      python.id,
      beginner.id,
      advanced.id,
      draft.id,
    ]);
  });

  it("filters by language, difficulty, category and status", () => {
    const q = DEFAULT_LIBRARY_QUERY;
    expect(ids(queryLibrary(all, { ...q, language: "python" }))).toEqual([python.id]);
    expect(ids(queryLibrary(all, { ...q, difficulty: "advanced" }))).toEqual([advanced.id]);
    expect(ids(queryLibrary(all, { ...q, category: "parsing" }))).toEqual([python.id]);
    expect(ids(queryLibrary(all, { ...q, status: "in-progress" }))).toEqual([draft.id]);
  });

  it("filters by date lower bound", () => {
    expect(ids(queryLibrary(all, { ...DEFAULT_LIBRARY_QUERY, from: "2099-01-01" }))).toEqual([]);
    expect(queryLibrary(all, { ...DEFAULT_LIBRARY_QUERY, from: "2026-09-20" })).toHaveLength(4);
  });

  it("searches title, language label and concepts with all terms required", () => {
    expect(ids(queryLibrary(all, { ...DEFAULT_LIBRARY_QUERY, search: "in-flight" }))).toEqual([
      advanced.id,
    ]);
    expect(ids(queryLibrary(all, { ...DEFAULT_LIBRARY_QUERY, search: "python log" }))).toEqual([
      python.id,
    ]);
    expect(queryLibrary(all, { ...DEFAULT_LIBRARY_QUERY, search: "python in-flight" })).toEqual([]);
  });
});

describe("library query params", () => {
  it("round-trips non-default values", () => {
    const query = {
      ...DEFAULT_LIBRARY_QUERY,
      search: "cache",
      language: "python" as const,
      sort: "title" as const,
      from: "2026-01-01",
    };
    expect(queryFromParams(queryToParams(query))).toEqual(query);
  });

  it("omits defaults and ignores invalid values", () => {
    expect(queryToParams(DEFAULT_LIBRARY_QUERY).toString()).toBe("");
    expect(
      queryFromParams(new URLSearchParams("language=cobol&sort=bogus&from=yesterday")),
    ).toEqual(DEFAULT_LIBRARY_QUERY);
  });
});
