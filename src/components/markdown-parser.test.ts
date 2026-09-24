import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "./markdown-parser";

describe("markdown", () => {
  it("parses paragraphs, headings, lists and code blocks", () => {
    const blocks = parseMarkdown(
      "# Title\n\nFirst line\ncontinues.\n\n- a\n- b\n\n1. one\n2. two\n\n```ts\nconst x = 1;\n```",
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "code"]);
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ text: "a" }], [{ text: "b" }]] });
    expect(blocks[4]).toEqual({ type: "code", language: "ts", text: "const x = 1;" });
  });

  it("parses inline code, emphasis and links", () => {
    expect(parseInline("use `Map` and **not** *arrays* [docs](https://example.com)")).toEqual([
      { type: "text", text: "use " },
      { type: "code", text: "Map" },
      { type: "text", text: " and " },
      { type: "strong", children: [{ type: "text", text: "not" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "arrays" }] },
      { type: "text", text: " " },
      { type: "link", href: "https://example.com/", children: [{ type: "text", text: "docs" }] },
    ]);
  });

  it("does not treat snake_case identifiers as emphasis", () => {
    expect(parseInline("call max_retry_count now")).toEqual([
      { type: "text", text: "call max_retry_count now" },
    ]);
  });

  it("keeps HTML as literal text (never interpreted)", () => {
    const [block] = parseMarkdown('<img src=x onerror="alert(1)">');
    expect(block).toEqual({
      type: "paragraph",
      children: [{ type: "text", text: '<img src=x onerror="alert(1)">' }],
    });
  });

  it("drops javascript: and other unsafe links", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,x")).toBeUndefined();
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { type: "text", text: "[x](javascript:alert(1)" },
      { type: "text", text: ")" },
    ]);
  });

  it("handles an unterminated code fence without hanging", () => {
    expect(parseMarkdown("```\nno end")).toEqual([{ type: "code", language: "", text: "no end" }]);
  });
});
