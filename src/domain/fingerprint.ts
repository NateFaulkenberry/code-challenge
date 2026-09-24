import type { ChallengeDraft } from "./challenge";

const STOP_WORDS = new Set(
  "a an and are as at be by for from has have in is it its of on or that the this to was were will with your you should must can each when which into than then them they their using use implement write build create function class returns return given".split(
    " ",
  ),
);

/** Lowercase, strip punctuation, drop stop words and very short tokens, light stemming. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
    .map(stem);
}

function stem(token: string): string {
  for (const suffix of ["ing", "ers", "er", "es", "ed", "s"]) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

/**
 * A stable, human-inspectable fingerprint: the sorted set of salient tokens.
 * Title tokens are included twice (prefixed) so they carry more weight.
 */
export function fingerprintChallenge(
  draft: Pick<
    ChallengeDraft,
    "title" | "problemStatement" | "requirements" | "archetype" | "language"
  >,
): string {
  const body = new Set([
    ...tokenize(draft.problemStatement),
    ...draft.requirements.flatMap(tokenize),
  ]);
  const title = tokenize(draft.title).map((t) => `t:${t}`);
  return [`lang:${draft.language}`, `arch:${draft.archetype}`, ...title, ...[...body].sort()]
    .slice(0, 400)
    .join(" ");
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

export function fingerprintSimilarity(a: string, b: string): number {
  return jaccard(new Set(a.split(" ")), new Set(b.split(" ")));
}

export const DUPLICATE_THRESHOLD = 0.6;

export interface DuplicateMatch {
  id: string;
  title: string;
  similarity: number;
}

export function findDuplicate(
  fingerprint: string,
  existing: readonly { id: string; title: string; fingerprint: string }[],
  threshold = DUPLICATE_THRESHOLD,
): DuplicateMatch | undefined {
  let best: DuplicateMatch | undefined;
  for (const candidate of existing) {
    const similarity = fingerprintSimilarity(fingerprint, candidate.fingerprint);
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { id: candidate.id, title: candidate.title, similarity };
    }
  }
  return best;
}
