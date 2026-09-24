import { DIFFICULTIES, type Difficulty } from "@/domain/difficulty";
import type { LanguageId } from "@/domain/languages";
import { LANGUAGE_AFFINITY, type Archetype, type Category } from "@/domain/taxonomy";

export interface GenerationRequest {
  language?: LanguageId;
  difficulty?: Difficulty;
  category?: Category;
  archetype?: Archetype;
}

export interface ResolvedRequest {
  language: LanguageId;
  difficulty: Difficulty;
  category: Category;
  archetype: Archetype;
}

export type Random = () => number;

export interface HistoryEntry {
  language: LanguageId;
  category: Category;
  archetype: Archetype;
}

function pickUniform<T>(items: readonly T[], random: Random): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

/** Weighted pick: items used often recently get proportionally less likely (1 / (1 + uses)). */
export function pickFresh<T>(
  items: readonly T[],
  recentUses: (item: T) => number,
  random: Random,
): T {
  const weights = items.map((item) => 1 / (1 + recentUses(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return items[i] as T;
  }
  return pickUniform(items, random);
}

/**
 * Fills unspecified parameters. Category and archetype are steered away from
 * what the user has seen recently in that language, which keeps generation
 * from converging on the same kind of task.
 */
export function resolveRequest(
  request: GenerationRequest,
  options: {
    availableLanguages: readonly LanguageId[];
    history: readonly HistoryEntry[];
    random?: Random;
  },
): ResolvedRequest {
  const random = options.random ?? Math.random;
  if (options.availableLanguages.length === 0)
    throw new Error("No languages are available for generation.");
  const language = request.language ?? pickUniform(options.availableLanguages, random);
  const difficulty = request.difficulty ?? pickUniform(DIFFICULTIES, random);
  const affinity = LANGUAGE_AFFINITY[language];
  const recent = options.history.filter((h) => h.language === language).slice(0, 12);
  const category =
    request.category ??
    pickFresh(affinity.categories, (c) => recent.filter((h) => h.category === c).length, random);
  const archetype =
    request.archetype ??
    pickFresh(affinity.archetypes, (a) => recent.filter((h) => h.archetype === a).length, random);
  return { language, difficulty, category, archetype };
}
