import { describe, expect, it } from "vitest";
import { createLoopGuard, instrumentLoops, LoopBudgetError } from "./loop-guard";

function run(code: string, budgetMs = 50): unknown {
  const guard = createLoopGuard(budgetMs);
  const names = Object.keys(guard.bindings);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(...names, `"use strict"; ${instrumentLoops(code)}`) as (
    ...args: unknown[]
  ) => unknown;
  return factory(...Object.values(guard.bindings));
}

describe("loop guards", () => {
  it("preserves behaviour of terminating loops of every kind", () => {
    const code = `
      let total = 0;
      for (let i = 0; i < 10; i++) total += i;
      for (const x of [1, 2]) { total += x; }
      for (const k in { a: 1 }) total += k.length;
      let n = 3; while (n--) total++;
      do { total++; } while (false);
      return total;`;
    expect(run(code)).toBe(45 + 3 + 1 + 3 + 1);
  });

  it("keeps single-statement bodies under if/else valid", () => {
    expect(run(`let c = 0; if (true) while (c < 5) c++; else for(;;) {} return c;`)).toBe(5);
  });

  it("keeps labelled continue/break working", () => {
    const code = `let hits = 0;
      outer: for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) { if (j === 1) continue outer; hits++; } }
      return hits;`;
    expect(run(code)).toBe(3);
  });

  it("stops infinite loops, including nested ones", () => {
    expect(() => run(`while (true) {}`)).toThrow(LoopBudgetError);
    expect(() => run(`for (;;) { for (let i = 0; i < 2; i++) {} }`)).toThrow(LoopBudgetError);
    expect(() => run(`do {} while (true)`)).toThrow(LoopBudgetError);
  });

  it("gives each loop entry its own budget", () => {
    // Many short loops over a long total time must not trip the guard.
    const code = `let s = 0; const end = Date.now() + 120; while (Date.now() < end) { for (let i = 0; i < 100; i++) s++; } return s > 0;`;
    expect(() => run(code, 1_000)).not.toThrow();
  });

  it("handles loops inside functions, classes and async code", () => {
    const code = `class A { m() { let i = 0; while (i < 3) i++; return i; } }
      const f = async () => { for await (const x of []) {} return new A().m(); };
      return f();`;
    return expect(run(code)).resolves.toBe(3);
  });
});
