import type { Attempt } from "./attempt";
import { DIFFICULTIES, type Difficulty } from "./difficulty";
import { LANGUAGE_IDS, type LanguageId } from "./languages";
import type { Category } from "./taxonomy";

export interface PortfolioStats {
  attempted: number;
  completed: number;
  byLanguage: { language: LanguageId; completed: number }[];
  byDifficulty: Record<Difficulty, number>;
  byCategory: Partial<Record<Category, number>>;
  /** Mean test runs needed to pass, over completed attempts; null if none. */
  averageRunsToPass: number | null;
  lastCompletedAt: string | null;
}

/** Every number shown on the dashboard is derived here from stored attempts. */
export function computeStats(attempts: readonly Attempt[]): PortfolioStats {
  const completed = attempts.filter((a) => a.status === "passed");
  const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) as Record<
    Difficulty,
    number
  >;
  const byCategory: Partial<Record<Category, number>> = {};
  const languageCounts = new Map<LanguageId, number>();

  for (const attempt of completed) {
    const { language, difficulty, category } = attempt.challenge;
    byDifficulty[difficulty]++;
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  }

  const byLanguage = LANGUAGE_IDS.map((language) => ({
    language,
    completed: languageCounts.get(language) ?? 0,
  }))
    .filter((entry) => entry.completed > 0)
    .sort((a, b) => b.completed - a.completed);

  const runs = completed.map((a) => a.testRunCount).filter((n) => n > 0);
  const completionDates = completed
    .map((a) => a.completedAt)
    .filter((d): d is string => d !== undefined)
    .sort();

  return {
    attempted: attempts.filter((a) => a.status !== "generated").length,
    completed: completed.length,
    byLanguage,
    byDifficulty,
    byCategory,
    averageRunsToPass: runs.length ? runs.reduce((s, n) => s + n, 0) / runs.length : null,
    lastCompletedAt: completionDates.at(-1) ?? null,
  };
}
