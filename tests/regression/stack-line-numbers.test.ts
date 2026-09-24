/**
 * Bug: runtime errors reported `solution.ts:4` for an error on line 1:
 * `new Function` adds two header lines and the strict-mode prelude added a
 * third. Fix: the prelude shares line 1, and frames are shifted by the
 * function header.
 */
import { describe, expect, it } from "vitest";
import { mapStackLine } from "@/runtimes/js/runner";
import { typescriptHandler } from "@/runtimes/typescript/handler";
import { recordingContext } from "../helpers/handler-context";

describe("regression: stack frames use the user's line numbers", () => {
  it("maps frames for the solution file only", () => {
    expect(mapStackLine("at eval (solution.ts:5:10)", "solution.ts")).toBe(
      "at eval (solution.ts:3:10)",
    );
    expect(mapStackLine("at other (tests.tsx:5:10)", "solution.ts")).toBe(
      "at other (tests.tsx:5:10)",
    );
  });

  it("points at line 1 for a one-line program", async () => {
    const ctx = recordingContext();
    await typescriptHandler.execute({ source: `throw new Error("first line");` }, ctx);
    expect(ctx.stderrText).toMatch(/solution\.ts:1:\d+/);
  });
});
