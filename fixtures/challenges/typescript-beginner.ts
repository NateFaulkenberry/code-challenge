import { defineFixture } from "./define";

export default defineFixture({
  title: "Normalize Article Tags",
  language: "typescript",
  difficulty: "beginner",
  category: "algorithms",
  archetype: "data-transformation",
  summary: "Clean up user-entered tags before they are stored: trim, lowercase, dedupe and sort.",
  problemStatement: `Authors type tags for their articles in a free-form input. Before the tags are saved, they need to be normalized so that \`"React "\`, \`"react"\` and \`" REACT"\` are treated as the same tag.

Implement \`normalizeTags(tags)\` which returns a new array of normalized tags.`,
  realWorldContext:
    "Content platforms normalize tags so search, filtering and tag clouds don't fragment across spelling variants.",
  requirements: [
    "Trim surrounding whitespace and lowercase each tag.",
    'Collapse internal runs of whitespace into a single hyphen (`"state  management"` → `"state-management"`).',
    "Drop tags that are empty after trimming.",
    "Remove duplicates and return the tags sorted alphabetically.",
    "Do not mutate the input array.",
  ],
  constraints: ["The input may contain up to 1,000 tags."],
  starterCode: `export function normalizeTags(tags: string[]): string[] {
  // TODO: implement
  return tags;
}
`,
  referenceSolution: `export function normalizeTags(tags: string[]): string[] {
  const normalized = tags
    .map((tag) => tag.trim().toLowerCase().replace(/\\s+/g, "-"))
    .filter((tag) => tag.length > 0);
  return [...new Set(normalized)].sort();
}
`,
  explanation:
    "Map each tag through the normalization steps, filter out empties, then use a `Set` to dedupe before sorting. Creating a new array via `map` keeps the input untouched.",
  complexity: { time: "O(n log n)", space: "O(n)" },
  tests: {
    prelude: `import { normalizeTags } from "./solution";`,
    cases: [
      {
        id: "trims-and-lowercases",
        name: "trims and lowercases",
        hidden: false,
        code: `expect(normalizeTags(["  React ", "TypeScript"])).toEqual(["react", "typescript"]);`,
      },
      {
        id: "dedupes",
        name: "removes duplicates after normalization",
        hidden: false,
        code: `expect(normalizeTags(["react", "React ", " REACT"])).toEqual(["react"]);`,
      },
      {
        id: "hyphenates-whitespace",
        name: "hyphenates internal whitespace",
        hidden: false,
        code: `expect(normalizeTags(["state   management"])).toEqual(["state-management"]);`,
      },
      {
        id: "drops-empty",
        name: "drops empty tags",
        hidden: true,
        code: `expect(normalizeTags(["", "   ", "css"])).toEqual(["css"]);`,
      },
      {
        id: "does-not-mutate",
        name: "does not mutate the input",
        hidden: true,
        code: `const input = ["B", "a"];\nnormalizeTags(input);\nexpect(input).toEqual(["B", "a"]);`,
      },
    ],
  },
  expectedConcepts: ["array methods", "Set", "string normalization", "immutability"],
  estimatedTimeMinutes: 10,
});
