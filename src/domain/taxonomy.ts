import { z } from "zod";
import type { LanguageId } from "./languages";

/**
 * Categories describe *what domain* a challenge exercises; archetypes describe
 * *what kind of task* it is. Generation picks both so output doesn't converge
 * on "implement an algorithm" every time.
 */
export const CATEGORIES = [
  "algorithms",
  "data-structures",
  "frontend",
  "react",
  "async",
  "apis",
  "parsing",
  "testing",
  "debugging",
  "performance",
  "concurrency",
  "systems",
  "file-processing",
  "state-management",
  "architecture",
] as const;

export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  algorithms: "Algorithms",
  "data-structures": "Data Structures",
  frontend: "Frontend",
  react: "React",
  async: "Async Programming",
  apis: "APIs",
  parsing: "Parsing",
  testing: "Testing",
  debugging: "Debugging",
  performance: "Performance",
  concurrency: "Concurrency",
  systems: "Systems",
  "file-processing": "File Processing",
  "state-management": "State Management",
  architecture: "Architecture",
};

export const ARCHETYPES = [
  "implementation",
  "debugging",
  "refactoring",
  "performance-optimization",
  "api-integration",
  "data-transformation",
  "state-management",
  "concurrency",
  "parsing",
  "caching",
  "algorithm",
  "data-structure",
  "ui-component",
  "architecture",
] as const;

export const ArchetypeSchema = z.enum(ARCHETYPES);
export type Archetype = z.infer<typeof ArchetypeSchema>;

export const ARCHETYPE_LABELS: Readonly<Record<Archetype, string>> = {
  implementation: "Implementation",
  debugging: "Debugging",
  refactoring: "Refactoring",
  "performance-optimization": "Performance Optimization",
  "api-integration": "API Integration",
  "data-transformation": "Data Transformation",
  "state-management": "State Management",
  concurrency: "Concurrency",
  parsing: "Parsing",
  caching: "Caching",
  algorithm: "Algorithm",
  "data-structure": "Data Structure",
  "ui-component": "UI Component",
  architecture: "Architecture",
};

/**
 * Which categories/archetypes make sense per language, given runtime limits
 * (e.g. no real threads in the Java/C++ runtimes, UI only in React).
 */
export const LANGUAGE_AFFINITY: Readonly<
  Record<LanguageId, { categories: readonly Category[]; archetypes: readonly Archetype[] }>
> = {
  typescript: {
    categories: [
      "algorithms",
      "data-structures",
      "async",
      "apis",
      "parsing",
      "performance",
      "state-management",
      "architecture",
      "testing",
      "debugging",
    ],
    archetypes: [
      "implementation",
      "debugging",
      "refactoring",
      "api-integration",
      "data-transformation",
      "state-management",
      "concurrency",
      "parsing",
      "caching",
      "algorithm",
      "data-structure",
      "architecture",
    ],
  },
  react: {
    categories: ["frontend", "react", "state-management", "async", "performance", "debugging"],
    archetypes: [
      "ui-component",
      "state-management",
      "debugging",
      "refactoring",
      "performance-optimization",
      "api-integration",
    ],
  },
  python: {
    categories: [
      "algorithms",
      "data-structures",
      "parsing",
      "file-processing",
      "apis",
      "testing",
      "performance",
      "debugging",
    ],
    archetypes: [
      "implementation",
      "debugging",
      "refactoring",
      "data-transformation",
      "parsing",
      "caching",
      "algorithm",
      "data-structure",
      "performance-optimization",
    ],
  },
  php: {
    categories: ["apis", "parsing", "data-structures", "architecture", "testing", "debugging"],
    archetypes: [
      "implementation",
      "debugging",
      "refactoring",
      "api-integration",
      "data-transformation",
      "parsing",
      "architecture",
    ],
  },
  c: {
    categories: ["systems", "data-structures", "algorithms", "parsing", "performance"],
    archetypes: [
      "implementation",
      "debugging",
      "data-structure",
      "algorithm",
      "parsing",
      "performance-optimization",
    ],
  },
  cpp: {
    categories: ["data-structures", "algorithms", "systems", "performance", "architecture"],
    archetypes: [
      "implementation",
      "debugging",
      "data-structure",
      "algorithm",
      "caching",
      "performance-optimization",
      "refactoring",
    ],
  },
  java: {
    categories: ["data-structures", "algorithms", "architecture", "parsing", "apis"],
    archetypes: [
      "implementation",
      "debugging",
      "refactoring",
      "data-structure",
      "algorithm",
      "caching",
      "architecture",
      "state-management",
    ],
  },
};
