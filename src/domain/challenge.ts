import { z } from "zod";
import { DifficultySchema } from "./difficulty";
import { LanguageIdSchema } from "./languages";
import { ArchetypeSchema, CategorySchema } from "./taxonomy";

export const CHALLENGE_SCHEMA_VERSION = 1;

/** Generous but finite limits: LLM and imported data are untrusted. */
export const LIMITS = {
  shortText: 200,
  paragraph: 4_000,
  document: 20_000,
  code: 50_000,
  listItems: 20,
  testCases: 40,
} as const;

const shortText = z.string().trim().min(1).max(LIMITS.shortText);
const paragraph = z.string().trim().min(1).max(LIMITS.paragraph);
const code = z.string().max(LIMITS.code);

export const TestCaseSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Test ids are lowercase kebab-case")
    .describe("Stable kebab-case identifier, unique within the challenge"),
  name: shortText.describe(
    "Human-readable behaviour under test, e.g. 'returns the cached promise'",
  ),
  description: paragraph.optional(),
  hidden: z.boolean().describe("Hidden tests only run on submit; use them for edge cases"),
  code: code.min(1).describe("Test body in the challenge language, using the harness assertions"),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const TestSuiteSchema = z.object({
  prelude: code.describe(
    "Shared setup placed before every test body (imports, helpers). May be empty.",
  ),
  cases: z.array(TestCaseSchema).min(1).max(LIMITS.testCases),
});
export type TestSuite = z.infer<typeof TestSuiteSchema>;

export const ComplexitySchema = z.object({
  time: z.string().trim().max(60),
  space: z.string().trim().max(60),
});

/**
 * The part of a challenge an author (human or LLM) writes. Identity and
 * provenance are assigned by the app, never trusted from the author.
 */
export const ChallengeDraftSchema = z.object({
  title: shortText,
  language: LanguageIdSchema,
  difficulty: DifficultySchema,
  category: CategorySchema,
  archetype: ArchetypeSchema,
  summary: paragraph.describe("One or two sentences for list views"),
  problemStatement: z.string().trim().min(1).max(LIMITS.document).describe("Markdown"),
  realWorldContext: paragraph.optional(),
  requirements: z.array(paragraph).min(1).max(LIMITS.listItems),
  constraints: z.array(paragraph).max(LIMITS.listItems),
  starterCode: code.min(1),
  referenceSolution: code.min(1),
  explanation: z
    .string()
    .trim()
    .min(1)
    .max(LIMITS.document)
    .describe("Markdown: the approach behind the reference solution"),
  complexity: ComplexitySchema.optional(),
  tests: TestSuiteSchema,
  expectedConcepts: z.array(shortText).min(1).max(LIMITS.listItems),
  estimatedTimeMinutes: z.number().int().min(1).max(240),
});
export type ChallengeDraft = z.infer<typeof ChallengeDraftSchema>;

export const ProvenanceSchema = z.object({
  source: z.enum(["llm", "fixture", "import"]),
  generatorVersion: z.string().max(80),
  model: z.string().max(120).optional(),
  generatedAt: z.iso.datetime(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const ChallengeSchema = ChallengeDraftSchema.extend({
  schemaVersion: z.literal(CHALLENGE_SCHEMA_VERSION),
  id: z.string().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  fingerprint: z.string().max(4_000),
  provenance: ProvenanceSchema,
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export function visibleTests(challenge: Pick<Challenge, "tests">): TestCase[] {
  return challenge.tests.cases.filter((t) => !t.hidden);
}

export function hiddenTestCount(challenge: Pick<Challenge, "tests">): number {
  return challenge.tests.cases.filter((t) => t.hidden).length;
}
