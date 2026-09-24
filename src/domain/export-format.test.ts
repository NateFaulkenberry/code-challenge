import { describe, expect, it } from "vitest";
import { at, makeChallenge, passedAttempt, T0 } from "../../tests/helpers/factories";
import { createAttempt, updateSolution } from "./attempt";
import { createBackup, createPortfolio, parseExportFile, planImport } from "./export-format";
import { DEFAULT_SETTINGS } from "./settings";

const passed = updateSolution(passedAttempt(makeChallenge(), at(1)), "edited after passing", at(2));
const draft = updateSolution(createAttempt(makeChallenge({ id: "draft" }), T0), "wip", at(3));

describe("export format", () => {
  it("round-trips a backup", () => {
    const backup = createBackup([passed, draft], DEFAULT_SETTINGS, T0);
    const parsed = parseExportFile(JSON.stringify(backup));
    expect(parsed).toEqual({ ok: true, file: backup, skipped: 0 });
  });

  it("portfolio exports only passed work, showing the passing snapshot", () => {
    const portfolio = createPortfolio([passed, draft], T0);
    expect(portfolio.kind).toBe("portfolio");
    expect(portfolio.settings).toBeUndefined();
    expect(portfolio.attempts.map((a) => a.id)).toEqual([passed.id]);
    expect(portfolio.attempts[0]?.solution).toBe(passed.passedSolution);
  });

  it("never includes secrets", () => {
    const text = JSON.stringify(createBackup([passed], DEFAULT_SETTINGS, T0));
    expect(text).not.toMatch(/apiKey|sk-ant/i);
  });

  it.each([
    ["not json", "{", "not valid JSON"],
    [
      "wrong format",
      JSON.stringify({ format: "other", version: 1 }),
      "not a Coding Challenge Lab export",
    ],
    ["missing version", JSON.stringify({ format: "coding-challenge-portfolio" }), "no version"],
    [
      "newer version",
      JSON.stringify({ format: "coding-challenge-portfolio", version: 99 }),
      "newer version",
    ],
    [
      "bad envelope",
      JSON.stringify({
        format: "coding-challenge-portfolio",
        version: 1,
        kind: "nope",
        attempts: [],
      }),
      "malformed",
    ],
  ])("rejects %s", (_label, text, message) => {
    const result = parseExportFile(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it("skips individually invalid attempts instead of failing the import", () => {
    const backup = createBackup([passed], DEFAULT_SETTINGS, T0);
    const text = JSON.stringify({ ...backup, attempts: [...backup.attempts, { id: "garbage" }] });
    const result = parseExportFile(text);
    expect(result.ok && result.skipped).toBe(1);
    expect(result.ok && result.file.attempts).toHaveLength(1);
  });
});

describe("planImport", () => {
  const existing = new Map([[passed.id, passed]]);
  const newer = { ...passed, updatedAt: at(10).toISOString() };
  const older = { ...passed, updatedAt: T0.toISOString() };

  it("adds new attempts", () => {
    expect(planImport([draft], existing, "skip")).toMatchObject({
      added: 1,
      updated: 0,
      skipped: 0,
    });
  });

  it("applies the duplicate strategy", () => {
    expect(planImport([older], existing, "skip")).toMatchObject({
      added: 0,
      updated: 0,
      skipped: 1,
    });
    expect(planImport([older], existing, "overwrite")).toMatchObject({ updated: 1 });
    expect(planImport([older], existing, "newest")).toMatchObject({ skipped: 1 });
    expect(planImport([newer], existing, "newest")).toMatchObject({ updated: 1 });
  });
});
