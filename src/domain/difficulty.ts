import { z } from "zod";

export const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;

export const DifficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof DifficultySchema>;

export interface DifficultyDefinition {
  id: Difficulty;
  label: string;
  rank: number;
  /** Concepts the generator should draw from at this level. */
  concepts: readonly string[];
  /** What "harder" means here — reasoning demands, not line count. */
  expectations: string;
  estimatedMinutes: readonly [min: number, max: number];
}

export const DIFFICULTY_DEFINITIONS: Readonly<Record<Difficulty, DifficultyDefinition>> = {
  beginner: {
    id: "beginner",
    label: "Beginner",
    rank: 0,
    concepts: [
      "functions",
      "arrays and lists",
      "strings",
      "objects/maps",
      "basic control flow",
      "simple components",
      "straightforward data transformation",
    ],
    expectations:
      "A single well-specified function or component. One obvious approach; edge cases limited to empty input and simple boundaries.",
    estimatedMinutes: [10, 20],
  },
  intermediate: {
    id: "intermediate",
    label: "Intermediate",
    rank: 1,
    concepts: [
      "data structures",
      "asynchronous operations",
      "state management",
      "error handling",
      "parsing",
      "classic algorithms",
      "API design",
      "modularity",
    ],
    expectations:
      "Several cooperating functions or a small class. Requires choosing a data structure and handling malformed input or failure paths.",
    estimatedMinutes: [20, 40],
  },
  advanced: {
    id: "advanced",
    label: "Advanced",
    rank: 2,
    concepts: [
      "concurrency and ordering",
      "caching and invalidation",
      "performance constraints",
      "complex state",
      "resource management",
      "non-trivial algorithms",
      "runtime behaviour",
    ],
    expectations:
      "Interacting requirements that constrain each other (e.g. correctness under concurrency plus bounded memory). Tests probe ordering, invariants and complexity.",
    estimatedMinutes: [35, 60],
  },
  expert: {
    id: "expert",
    label: "Expert",
    rank: 3,
    concepts: [
      "nontrivial algorithms with proofs of complexity",
      "strict performance budgets",
      "systems concepts",
      "memory/resource ownership",
      "architectural trade-offs",
      "subtle debugging",
      "language-specific edge cases",
    ],
    expectations:
      "Requires insight, not just diligence: amortised analysis, careful invariants, or diagnosing a subtle defect. Hidden tests target the edge cases a first draft misses.",
    estimatedMinutes: [50, 90],
  },
};

export const DIFFICULTY_LIST: readonly DifficultyDefinition[] = DIFFICULTIES.map(
  (id) => DIFFICULTY_DEFINITIONS[id],
);

export function compareDifficulty(a: Difficulty, b: Difficulty): number {
  return DIFFICULTY_DEFINITIONS[a].rank - DIFFICULTY_DEFINITIONS[b].rank;
}
