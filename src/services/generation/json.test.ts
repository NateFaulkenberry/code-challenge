import { describe, expect, it } from "vitest";
import { challengeDraftJsonSchema, extractJson, toPortableSchema } from "./json";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("finds an object surrounded by prose, respecting braces inside strings", () => {
    expect(extractJson('Sure! {"code":"if (x) { y }","n":2} Hope it helps')).toEqual({
      code: "if (x) { y }",
      n: 2,
    });
  });

  it("returns undefined for garbage or truncated JSON", () => {
    expect(extractJson("no json here")).toBeUndefined();
    expect(extractJson('{"a": "unterminated')).toBeUndefined();
  });
});

describe("provider JSON schema", () => {
  it("strips unportable keywords and closes objects", () => {
    expect(
      toPortableSchema({
        type: "object",
        properties: { s: { type: "string", maxLength: 3, pattern: "x" } },
      }),
    ).toEqual({
      type: "object",
      properties: { s: { type: "string" } },
      additionalProperties: false,
    });
  });

  it("keeps a property literally named like a keyword", () => {
    const schema = toPortableSchema({
      type: "object",
      properties: { pattern: { type: "string" } },
    }) as {
      properties: Record<string, unknown>;
    };
    expect(schema.properties.pattern).toEqual({ type: "string" });
  });

  it("derives the challenge schema from Zod with required fields", () => {
    const schema = challengeDraftJsonSchema() as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.required).toEqual(
      expect.arrayContaining(["title", "starterCode", "referenceSolution", "tests"]),
    );
    expect(JSON.stringify(schema)).not.toMatch(/maxLength|"pattern"/);
  });
});
