import { describe, expect as vexpect, it } from "vitest";
import { AssertionError, deepEqual, expect, fn } from "./expect";

const fails = (f: () => unknown) => vexpect(f).toThrow(AssertionError);

describe("harness expect", () => {
  it("compares structurally", () => {
    vexpect(deepEqual({ a: [1, { b: 2 }], c: undefined }, { a: [1, { b: 2 }] })).toBe(true);
    vexpect(deepEqual(new Map([[1, { x: 1 }]]), new Map([[1, { x: 1 }]]))).toBe(true);
    vexpect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    vexpect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    vexpect(deepEqual(NaN, NaN)).toBe(true);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    vexpect(deepEqual(cyclic, cyclic)).toBe(true);
  });

  it("supports common matchers and negation", () => {
    expect(1).toBe(1);
    expect([1, 2]).toContain(2);
    expect({ a: { b: 1 } }).toHaveProperty("a.b", 1);
    expect("hello").not.toMatch(/bye/);
    fails(() => expect(1).toBe(2));
    fails(() => expect(1).not.toBe(1));
  });

  it("produces readable messages", () => {
    vexpect(() => expect([1]).toEqual([2])).toThrow("expected [ 1 ] to equal [ 2 ]");
    vexpect(() => expect(1).not.toBe(1)).toThrow("expected 1 not to be 1");
  });

  it("explains identity failures for distinct objects", () => {
    vexpect(() => expect(Promise.resolve(1)).toBe(Promise.resolve(1))).toThrow(
      "toBe compares identity",
    );
  });

  it("checks thrown errors", () => {
    expect(() => {
      throw new RangeError("out of range");
    }).toThrow(RangeError);
    fails(() => expect(() => undefined).toThrow());
  });

  it("supports resolves/rejects", async () => {
    await expect(Promise.resolve(3)).resolves.toBe(3);
    await expect(Promise.reject(new Error("boom"))).rejects.toThrow("boom");
    await vexpect(expect(Promise.resolve(1)).rejects.toThrow()).rejects.toThrow(AssertionError);
  });

  it("tracks mock calls", () => {
    const spy = fn((x: number) => x * 2);
    vexpect(spy(2)).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(2);
  });
});
