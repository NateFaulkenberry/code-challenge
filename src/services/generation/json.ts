import { z } from "zod";
import { ChallengeDraftSchema } from "@/domain/challenge";

/**
 * Extracts the first top-level JSON object from model text. Tolerates code
 * fences and prose around the object; returns undefined if none parses.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to scanning
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // keep scanning
    }
  }
  const start = trimmed.indexOf("{");
  if (start === -1) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      try {
        return JSON.parse(trimmed.slice(start, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * Keywords structured-output implementations commonly reject. Stripping them
 * keeps the provider schema portable; Zod still enforces every constraint on
 * the response.
 */
const UNPORTABLE_KEYWORDS = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "maxItems",
  "minItems",
]);

export function toPortableSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toPortableSchema);
  if (typeof value !== "object" || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (UNPORTABLE_KEYWORDS.has(key)) continue;
    result[key] =
      key === "properties" ? mapValues(child, toPortableSchema) : toPortableSchema(child);
  }
  if (result.type === "object") result.additionalProperties = false;
  return result;
}

function mapValues(value: unknown, fn: (v: unknown) => unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fn(v)]));
}

let cached: unknown;
/** JSON Schema for the challenge draft, derived from the Zod schema (single source of truth). */
export function challengeDraftJsonSchema(): unknown {
  cached ??= toPortableSchema(
    z.toJSONSchema(ChallengeDraftSchema, { target: "draft-7", io: "input" }),
  );
  return cached;
}
