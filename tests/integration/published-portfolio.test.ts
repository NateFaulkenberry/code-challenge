/**
 * The committed portfolio is served to every visitor. A malformed file would
 * silently empty the public portfolio, so CI rejects it before deployment.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseExportFile } from "@/domain/export-format";

describe("published portfolio (public/portfolio/portfolio.json)", () => {
  const text = readFileSync(
    new URL("../../public/portfolio/portfolio.json", import.meta.url),
    "utf8",
  );
  const parsed = parseExportFile(text);

  it("is a valid portfolio export", () => {
    expect(parsed.ok, parsed.ok ? "" : parsed.error).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.kind).toBe("portfolio");
      expect(parsed.skipped).toBe(0);
    }
  });

  it("contains only completed work and no settings", () => {
    if (!parsed.ok) return;
    expect(parsed.file.settings).toBeUndefined();
    for (const attempt of parsed.file.attempts) {
      expect(attempt.status, attempt.id).toBe("passed");
      expect(attempt.passedSolution, attempt.id).toBeDefined();
    }
  });
});
