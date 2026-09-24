export const DEFAULT_OUTPUT_LIMIT = 64 * 1024;

/**
 * Accumulates text up to a character budget. Anything beyond the budget is
 * dropped (not buffered), so runaway output can't exhaust memory.
 */
export class OutputBuffer {
  private chunks: string[] = [];
  private size = 0;
  truncated = false;

  constructor(private readonly limit: number = DEFAULT_OUTPUT_LIMIT) {}

  /** Returns the portion of `text` that was accepted (possibly empty). */
  append(text: string): string {
    if (this.truncated || text.length === 0) return "";
    const remaining = this.limit - this.size;
    if (text.length <= remaining) {
      this.chunks.push(text);
      this.size += text.length;
      return text;
    }
    const accepted = text.slice(0, remaining);
    this.chunks.push(accepted);
    this.size = this.limit;
    this.truncated = true;
    return accepted;
  }

  toString(): string {
    return this.chunks.join("");
  }
}

/** Formats values the way a developer console would, without invoking user getters unsafely. */
export function formatValue(value: unknown, seen = new WeakSet<object>(), depth = 0): string {
  if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `[Function ${value.name || "(anonymous)"}]`;
  if (value === null || typeof value !== "object") return String(value);
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  if (seen.has(value)) return "[Circular]";
  if (depth > 4) return Array.isArray(value) ? "[Array]" : "[Object]";
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[ ${value.map((v) => formatValue(v, seen, depth + 1)).join(", ")} ]`;
    }
    if (value instanceof Map) {
      const entries = [...value].map(
        ([k, v]) => `${formatValue(k, seen, depth + 1)} => ${formatValue(v, seen, depth + 1)}`,
      );
      return `Map(${value.size}) { ${entries.join(", ")} }`;
    }
    if (value instanceof Set) {
      return `Set(${value.size}) { ${[...value].map((v) => formatValue(v, seen, depth + 1)).join(", ")} }`;
    }
    if (value instanceof Promise) return "Promise { <pending> }";
    const entries = Object.entries(value).map(
      ([k, v]) => `${k}: ${formatValue(v, seen, depth + 1)}`,
    );
    // Objects from Object.create(null) have no constructor at all.
    const ctor = (value as { constructor?: { name?: string } }).constructor;
    const name = ctor && ctor !== Object && ctor.name ? `${ctor.name} ` : "";
    return entries.length ? `${name}{ ${entries.join(", ")} }` : `${name}{}`;
  } finally {
    seen.delete(value);
  }
}
