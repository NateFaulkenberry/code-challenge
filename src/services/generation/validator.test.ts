import { describe, expect, it } from "vitest";
import tsAdvanced from "../../../fixtures/challenges/typescript-advanced";
import { createInProcessRuntime } from "../../../tests/helpers/in-process-runtime";
import { ChallengeDraftSchema } from "@/domain/challenge";
import { typescriptHandler } from "@/runtimes/typescript/handler";
import { checkLanguageRules } from "./language-rules";
import { validateDraft, validateInRuntime } from "./validator";

const draft = ChallengeDraftSchema.parse(tsAdvanced);
const request = {
  language: "typescript",
  difficulty: "advanced",
  category: "async",
  archetype: "caching",
} as const;

describe("validateDraft", () => {
  it("accepts a valid draft", () => {
    expect(validateDraft(draft, request).ok).toBe(true);
  });

  it("reports schema problems with field paths", () => {
    const result = validateDraft({ ...draft, title: "" }, request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain("`title`");
  });

  it("rejects language/difficulty mismatches", () => {
    const result = validateDraft({ ...draft, difficulty: "beginner" }, request);
    expect(!result.ok && result.problems).toEqual([expect.stringContaining("`difficulty`")]);
  });

  it("requires unique ids and both visible and hidden tests", () => {
    const cases = draft.tests.cases.map((c) => ({ ...c, id: "same", hidden: false }));
    const result = validateDraft({ ...draft, tests: { ...draft.tests, cases } }, request);
    expect(!result.ok && result.problems.join("\n")).toMatch(/unique[\s\S]*hidden/);
  });

  it("rejects a starter identical to the reference", () => {
    const result = validateDraft({ ...draft, starterCode: draft.referenceSolution }, request);
    expect(result.ok).toBe(false);
  });
});

describe("checkLanguageRules", () => {
  it("rejects disallowed imports in TypeScript", () => {
    expect(
      checkLanguageRules("typescript", {
        solution: `import _ from "lodash";`,
        starter: "",
        tests: "",
      }),
    ).toHaveLength(1);
    expect(
      checkLanguageRules("typescript", {
        solution: "",
        starter: "",
        tests: `import { a } from "./solution";`,
      }),
    ).toEqual([]);
  });

  it("allows Testing Library in React tests but not in solutions", () => {
    const tests = `import { render } from "@testing-library/react";\nimport userEvent from "@testing-library/user-event";`;
    expect(
      checkLanguageRules("react", {
        solution: `import { useState } from "react";`,
        starter: "",
        tests,
      }),
    ).toEqual([]);
    expect(
      checkLanguageRules("react", { solution: tests, starter: "", tests: "" }).length,
    ).toBeGreaterThan(0);
  });

  it("rejects C++ exceptions, Python packages and Java threads", () => {
    expect(
      checkLanguageRules("cpp", {
        solution: "try { f(); } catch (...) {}",
        starter: "",
        tests: "",
      }),
    ).toHaveLength(1);
    expect(
      checkLanguageRules("python", { solution: "import numpy as np", starter: "", tests: "" }),
    ).toHaveLength(1);
    expect(
      checkLanguageRules("java", { solution: "new Thread(r).start();", starter: "", tests: "" }),
    ).toHaveLength(1);
  });
});

describe("validateInRuntime", () => {
  const { runtime } = createInProcessRuntime("typescript", typescriptHandler);

  it("accepts a consistent draft", async () => {
    expect(await validateInRuntime(draft, runtime, 5_000)).toEqual([]);
  });

  it("rejects a reference solution that fails its own tests", async () => {
    const broken = {
      ...draft,
      referenceSolution: draft.starterCode.replace(
        "return fetcher(key);",
        "return fetcher(key + '!');",
      ),
    };
    const problems = await validateInRuntime(broken, runtime, 5_000);
    expect(problems.some((p) => p.includes("reference solution fails test"))).toBe(true);
  });

  it("rejects a starter that already passes", async () => {
    const trivial = { ...draft, starterCode: `${draft.referenceSolution}\n// starter` };
    const problems = await validateInRuntime(trivial, runtime, 5_000);
    expect(problems).toEqual([expect.stringContaining("already passes")]);
  });

  it("rejects a starter that does not compile", async () => {
    const problems = await validateInRuntime(
      { ...draft, starterCode: "export const = ;" },
      runtime,
      5_000,
    );
    expect(problems).toEqual([expect.stringContaining("does not compile")]);
  });
});
