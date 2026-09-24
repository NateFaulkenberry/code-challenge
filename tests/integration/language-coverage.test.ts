/**
 * Invariant: every language with a real runtime is fully wired up — the
 * generator knows its harness, there is a fixture proving the runtime
 * contract, and the editor and taxonomy cover it.
 */
import { describe, expect, it } from "vitest";
import { FIXTURE_LIST } from "../../fixtures/challenges";
import { LANGUAGES } from "@/domain/languages";
import { LANGUAGE_AFFINITY } from "@/domain/taxonomy";
import { EDITOR_MODES } from "@/editor/modes";
import { implementedLanguages, RUNTIMES } from "@/runtimes/registry";
import { buildGenerationPrompt, harnessDoc } from "@/services/generation/prompt-builder";

describe.each(implementedLanguages())("%s is fully supported", (language) => {
  it("has generator harness documentation and a buildable prompt", () => {
    expect(harnessDoc(language)).toBeTruthy();
    const { category, archetype } = {
      category: LANGUAGE_AFFINITY[language].categories[0]!,
      archetype: LANGUAGE_AFFINITY[language].archetypes[0]!,
    };
    expect(() =>
      buildGenerationPrompt({
        request: { language, difficulty: "intermediate", category, archetype },
        avoidTitles: [],
      }),
    ).not.toThrow();
  });

  it("has at least one fixture", () => {
    expect(FIXTURE_LIST.some((f) => f.language === language)).toBe(true);
  });

  it("has an editor mode and runtime constraints", () => {
    expect(EDITOR_MODES[language]).toBeTypeOf("function");
    expect(LANGUAGES[language].constraints.length).toBeGreaterThan(0);
  });
});

describe("planned languages", () => {
  it("never fake execution", async () => {
    for (const [language, entry] of Object.entries(RUNTIMES)) {
      if (entry.implemented) continue;
      const runtime = await entry.load();
      expect(runtime.isSupported().supported, language).toBe(false);
    }
  });
});
