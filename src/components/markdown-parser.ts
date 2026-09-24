/**
 * A deliberately small Markdown subset for challenge text (LLM-authored, so
 * untrusted). It produces a typed AST that is rendered to React elements —
 * raw HTML is never interpreted, and only http(s) links are kept.
 */
export type Inline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "code"; language: string; text: string }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] };

const INLINE_PATTERN =
  /(`+)([\s\S]*?[^`])\1(?!`)|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_(?![A-Za-z0-9])|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function safeHref(href: string): string | undefined {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index;
    if (index > last) nodes.push({ type: "text", text: text.slice(last, index) });
    const [whole, , code, strongA, strongB, emA, emB, linkText, linkHref] = match;
    if (code !== undefined)
      nodes.push({
        type: "code",
        text: code.trim() === "" ? code : code.replace(/^ (.*) $/, "$1"),
      });
    else if (strongA ?? strongB)
      nodes.push({ type: "strong", children: parseInline(strongA ?? strongB ?? "") });
    else if (emA ?? emB) nodes.push({ type: "em", children: parseInline(emA ?? emB ?? "") });
    else if (linkText !== undefined && linkHref !== undefined) {
      const href = safeHref(linkHref);
      nodes.push(
        href
          ? { type: "link", href, children: parseInline(linkText) }
          : { type: "text", text: whole },
      );
    }
    last = index + whole.length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes;
}

const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length)
      blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const fence = /^\s*(```|~~~)\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      flushParagraph();
      const closing = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith(closing ?? "```"))
        body.push(lines[i++] ?? "");
      i++;
      blocks.push({ type: "code", language: fence[2] ?? "", text: body.join("\n") });
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: (heading[1]?.length ?? 1) as 1 | 2 | 3 | 4,
        children: parseInline(heading[2] ?? ""),
      });
      i++;
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flushParagraph();
      const ordered = item[2] !== undefined;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const current = LIST_ITEM.exec(lines[i] ?? "");
        if (!current || (current[2] !== undefined) !== ordered) break;
        let text = current[3] ?? "";
        i++;
        // Continuation lines (indented, not a new item or blank).
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i] ?? "") &&
          !LIST_ITEM.test(lines[i] ?? "")
        ) {
          text += ` ${(lines[i] ?? "").trim()}`;
          i++;
        }
        items.push(parseInline(text));
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i] ?? ""))
        quote.push((lines[i++] ?? "").replace(/^\s*>\s?/, ""));
      blocks.push({ type: "quote", children: parseInline(quote.join(" ")) });
      continue;
    }
    if (line.trim() === "") flushParagraph();
    else paragraph.push(line.trim());
    i++;
  }
  flushParagraph();
  return blocks;
}
