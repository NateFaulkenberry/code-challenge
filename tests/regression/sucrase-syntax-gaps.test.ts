/**
 * Bug: sucrase only strips types; it accepts some invalid JavaScript, which
 * then failed inside `new Function` with an unhelpful runtime error.
 * Fix: the transpiled output is parsed by acorn (needed anyway for loop
 * guards), turning these into compile errors with line numbers.
 */
import { describe, expect, it } from "vitest";
import { typescriptHandler } from "@/runtimes/typescript/handler";
import { recordingContext } from "../helpers/handler-context";

describe("regression: syntax sucrase lets through", () => {
  it.each([
    ["reserved word as binding", `let let = 1;`],
    ["duplicate parameter in strict code", `function f(a, a) {}`],
  ])("reports %s as a compile error", async (_label, source) => {
    const outcome = await typescriptHandler.execute({ source }, recordingContext());
    expect(outcome.status).toBe("compile-error");
    expect(outcome.diagnostics[0]?.line).toBe(1);
  });
});
