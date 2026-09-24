import { Fragment, useMemo, type ReactNode } from "react";
import { parseMarkdown, type Inline } from "./markdown-parser";
import styles from "./Markdown.module.css";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return <Fragment key={i}>{node.text}</Fragment>;
      case "code":
        return <code key={i}>{node.text}</code>;
      case "strong":
        return <strong key={i}>{renderInline(node.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(node.children)}</em>;
      case "link":
        return (
          <a key={i} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <div className={[styles.markdown, className].filter(Boolean).join(" ")}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            const Tag = `h${Math.min(block.level + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
            return <Tag key={i}>{renderInline(block.children)}</Tag>;
          }
          case "paragraph":
            return <p key={i}>{renderInline(block.children)}</p>;
          case "code":
            return (
              <pre key={i} data-language={block.language || undefined}>
                <code>{block.text}</code>
              </pre>
            );
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return <blockquote key={i}>{renderInline(block.children)}</blockquote>;
        }
      })}
    </div>
  );
}
