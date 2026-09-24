import { DIFFICULTY_DEFINITIONS } from "@/domain/difficulty";
import { LANGUAGES, type LanguageId } from "@/domain/languages";
import { ARCHETYPE_LABELS, CATEGORY_LABELS, type Archetype } from "@/domain/taxonomy";
import generatorTemplate from "../../../prompts/challenge-generator-v1.md?raw";
import repairTemplate from "../../../prompts/challenge-repair-v1.md?raw";
import type { ResolvedRequest } from "./request";

export const GENERATOR_VERSION = "challenge-generator-v1";

const harnessDocs = import.meta.glob<string>("../../../prompts/harness-v1/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function harnessDoc(language: LanguageId): string | undefined {
  return Object.entries(harnessDocs).find(([path]) => path.endsWith(`/${language}.md`))?.[1];
}

export const ARCHETYPE_GUIDANCE: Readonly<Record<Archetype, string>> = {
  implementation: "build a well-specified feature from scratch.",
  debugging:
    "the starter code has one or more realistic bugs; describe symptoms and let the solver find the cause.",
  refactoring:
    "the starter code works for simple cases but is tangled or fragile; requirements add cases it cannot handle without restructuring.",
  "performance-optimization":
    "the starter code is correct but too slow for the stated constraints; tests include a larger input.",
  "api-integration":
    "wrap or consume an API-like interface (injected as a parameter), handling errors, retries or pagination.",
  "data-transformation": "reshape, aggregate or normalize realistic data records.",
  "state-management": "manage state transitions correctly over a sequence of events or actions.",
  concurrency:
    "coordinate interleaved asynchronous operations correctly (ordering, cancellation, deduplication), within the runtime's constraints.",
  parsing: "parse a realistic text format with clear error reporting for malformed input.",
  caching: "add caching with explicit eviction or invalidation semantics.",
  algorithm:
    "solve a problem whose efficient solution requires a known algorithmic technique, framed in a practical scenario.",
  "data-structure": "design and implement a data structure with stated complexity guarantees.",
  "ui-component": "build an interactive, accessible UI component with clear states.",
  architecture:
    "design small cooperating modules/interfaces; tests exercise behaviour through the public API.",
};

function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Prompt template variable "${key}" has no value`);
    return value;
  });
}

export interface PromptInput {
  request: ResolvedRequest;
  /** Titles of recent challenges, newest first. */
  avoidTitles: readonly string[];
}

export interface BuiltPrompt {
  system: string;
  user: string;
  version: string;
}

export function buildGenerationPrompt({ request, avoidTitles }: PromptInput): BuiltPrompt {
  const language = LANGUAGES[request.language];
  const difficulty = DIFFICULTY_DEFINITIONS[request.difficulty];
  const harness = harnessDoc(request.language);
  if (!harness) throw new Error(`No test harness documentation for ${language.label}`);
  const system = fill(generatorTemplate, {
    language: language.id,
    languageLabel: language.label,
    difficultyLabel: difficulty.label,
    difficultyExpectations: difficulty.expectations,
    difficultyConcepts: difficulty.concepts.join(", "),
    category: request.category,
    categoryLabel: CATEGORY_LABELS[request.category],
    archetype: request.archetype,
    archetypeLabel: ARCHETYPE_LABELS[request.archetype],
    archetypeGuidance: ARCHETYPE_GUIDANCE[request.archetype],
    minMinutes: String(difficulty.estimatedMinutes[0]),
    maxMinutes: String(difficulty.estimatedMinutes[1]),
    languageConstraints: language.constraints.map((c) => `- ${c}`).join("\n"),
    testHarness: harness.trim(),
    avoidList: avoidTitles.length
      ? avoidTitles
          .slice(0, 30)
          .map((t) => `- ${t}`)
          .join("\n")
      : "- (none yet)",
  });
  const user = `Generate a new ${difficulty.label} ${language.label} challenge in the ${CATEGORY_LABELS[request.category]} category using the ${ARCHETYPE_LABELS[request.archetype]} archetype.`;
  return { system, user, version: GENERATOR_VERSION };
}

export function buildRepairPrompt(problems: readonly string[]): string {
  return fill(repairTemplate, { problems: problems.map((p) => `- ${p}`).join("\n") });
}
