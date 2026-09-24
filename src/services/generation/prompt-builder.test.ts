import { describe, expect, it } from "vitest";
import {
  buildGenerationPrompt,
  buildRepairPrompt,
  GENERATOR_VERSION,
  harnessDoc,
} from "./prompt-builder";

const request = {
  language: "typescript",
  difficulty: "advanced",
  category: "async",
  archetype: "caching",
} as const;

describe("prompt builder", () => {
  it("fills every placeholder", () => {
    const prompt = buildGenerationPrompt({ request, avoidTitles: ["Request Deduplication Cache"] });
    expect(prompt.system).not.toMatch(/\{\{\w+\}\}/);
    expect(prompt.version).toBe(GENERATOR_VERSION);
  });

  it("includes difficulty expectations, language constraints and the harness", () => {
    const { system } = buildGenerationPrompt({ request, avoidTitles: [] });
    expect(system).toContain("Advanced");
    expect(system).toContain("Interacting requirements");
    expect(system).toContain("No npm packages");
    expect(system).toContain("body of an async function");
    expect(system).toContain("(none yet)");
  });

  it("lists titles to avoid", () => {
    const { system } = buildGenerationPrompt({
      request,
      avoidTitles: ["Ring Buffer", "LRU Cache"],
    });
    expect(system).toContain("- Ring Buffer\n- LRU Cache");
  });

  it("builds repair prompts from problems", () => {
    expect(buildRepairPrompt(["a is wrong", "b is missing"])).toContain(
      "- a is wrong\n- b is missing",
    );
  });

  it("has harness docs for implemented languages", () => {
    expect(harnessDoc("typescript")).toBeTruthy();
    expect(harnessDoc("react")).toBeTruthy();
  });
});
