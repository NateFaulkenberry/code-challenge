import type { Attempt, AttemptStatus } from "./attempt";
import { ATTEMPT_STATUSES } from "./attempt";
import { compareDifficulty, DIFFICULTIES, type Difficulty } from "./difficulty";
import { LANGUAGE_IDS, LANGUAGES, type LanguageId } from "./languages";
import { CATEGORIES, type Category } from "./taxonomy";

export const SORT_KEYS = ["newest", "oldest", "difficulty", "language", "title"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface LibraryQuery {
  search: string;
  language: LanguageId | "all";
  difficulty: Difficulty | "all";
  category: Category | "all";
  status: AttemptStatus | "all";
  /** Inclusive ISO date (yyyy-mm-dd) lower bound on the activity date. */
  from?: string;
  sort: SortKey;
}

export const DEFAULT_LIBRARY_QUERY: LibraryQuery = {
  search: "",
  language: "all",
  difficulty: "all",
  category: "all",
  status: "all",
  sort: "newest",
};

/** Completed work is dated by completion; everything else by last activity. */
export function activityDate(attempt: Attempt): string {
  return attempt.completedAt ?? attempt.updatedAt;
}

function matchesSearch(attempt: Attempt, search: string): boolean {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const { challenge } = attempt;
  const haystack = [
    challenge.title,
    challenge.summary,
    LANGUAGES[challenge.language].label,
    challenge.category,
    ...challenge.expectedConcepts,
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

const comparators: Record<SortKey, (a: Attempt, b: Attempt) => number> = {
  newest: (a, b) => activityDate(b).localeCompare(activityDate(a)),
  oldest: (a, b) => activityDate(a).localeCompare(activityDate(b)),
  difficulty: (a, b) => compareDifficulty(b.challenge.difficulty, a.challenge.difficulty),
  language: (a, b) =>
    LANGUAGES[a.challenge.language].label.localeCompare(LANGUAGES[b.challenge.language].label),
  title: (a, b) => a.challenge.title.localeCompare(b.challenge.title),
};

export function queryLibrary(attempts: readonly Attempt[], query: LibraryQuery): Attempt[] {
  const compare = comparators[query.sort];
  return attempts
    .filter(
      (a) =>
        (query.language === "all" || a.challenge.language === query.language) &&
        (query.difficulty === "all" || a.challenge.difficulty === query.difficulty) &&
        (query.category === "all" || a.challenge.category === query.category) &&
        (query.status === "all" || a.status === query.status) &&
        (!query.from || activityDate(a).slice(0, 10) >= query.from) &&
        matchesSearch(a, query.search),
    )
    .sort((a, b) => compare(a, b) || activityDate(b).localeCompare(activityDate(a)));
}

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | "all" {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : "all";
}

/** Reads a query from URL search params, ignoring anything invalid. */
export function queryFromParams(params: URLSearchParams): LibraryQuery {
  const sort = params.get("sort");
  const from = params.get("from");
  return {
    search: params.get("q")?.slice(0, 200) ?? "",
    language: oneOf(LANGUAGE_IDS, params.get("language")),
    difficulty: oneOf(DIFFICULTIES, params.get("difficulty")),
    category: oneOf(CATEGORIES, params.get("category")),
    status: oneOf(ATTEMPT_STATUSES, params.get("status")),
    sort: (SORT_KEYS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : "newest",
    ...(from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? { from } : {}),
  };
}

/** Serializes only non-default values, keeping URLs short and shareable. */
export function queryToParams(query: LibraryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  for (const key of ["language", "difficulty", "category", "status"] as const) {
    if (query[key] !== "all") params.set(key, query[key]);
  }
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.from) params.set("from", query.from);
  return params;
}
