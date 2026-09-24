import { describe, expect, it } from "vitest";
import { formatValue, OutputBuffer } from "./output";

describe("OutputBuffer", () => {
  it("accepts output under the limit", () => {
    const buffer = new OutputBuffer(10);
    expect(buffer.append("hello")).toBe("hello");
    expect(buffer.truncated).toBe(false);
  });

  it("cuts at the limit and drops everything afterwards", () => {
    const buffer = new OutputBuffer(8);
    buffer.append("hello");
    expect(buffer.append("world")).toBe("wor");
    expect(buffer.append("more")).toBe("");
    expect(buffer.toString()).toBe("hellowor");
    expect(buffer.truncated).toBe(true);
  });
});

describe("formatValue", () => {
  it("formats like a console", () => {
    expect(formatValue("plain")).toBe("plain");
    expect(formatValue({ a: "x", b: [1, 2] })).toBe('{ a: "x", b: [ 1, 2 ] }');
    expect(formatValue(new Map([["k", 1]]))).toBe('Map(1) { "k" => 1 }');
    expect(formatValue(10n)).toBe("10n");
  });

  it("handles cycles and depth", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(formatValue(cyclic)).toBe("{ self: [Circular] }");
    expect(formatValue({ a: { b: { c: { d: { e: { f: 1 } } } } } })).toContain("[Object]");
  });
});
