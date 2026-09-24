import { z } from "zod";
import { AttemptSchema, type Attempt } from "./attempt";
import { SettingsSchema, type Settings } from "./settings";

export const EXPORT_FORMAT = "coding-challenge-portfolio";
export const EXPORT_VERSION = 1;

export const ExportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  kind: z.enum(["backup", "portfolio"]),
  exportedAt: z.iso.datetime(),
  attempts: z.array(AttemptSchema).max(5_000),
  settings: SettingsSchema.optional(),
});
export type ExportFile = z.infer<typeof ExportFileSchema>;

export function createBackup(
  attempts: readonly Attempt[],
  settings: Settings,
  now: Date,
): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    kind: "backup",
    exportedAt: now.toISOString(),
    attempts: [...attempts],
    settings,
  };
}

/**
 * Only completed work, presented as it passed: the current editor contents are
 * replaced by the snapshot that passed the full suite.
 */
export function createPortfolio(attempts: readonly Attempt[], now: Date): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    kind: "portfolio",
    exportedAt: now.toISOString(),
    attempts: attempts
      .filter((a) => a.status === "passed" && a.passedSolution !== undefined)
      .map((a) => ({ ...a, solution: a.passedSolution ?? a.solution })),
  };
}

export type ParseExportResult =
  { ok: true; file: ExportFile; skipped: number } | { ok: false; error: string; details?: string };

/**
 * Parse an untrusted export. The envelope must be valid; individual attempts
 * that fail validation are skipped and counted rather than failing the whole import.
 */
export function parseExportFile(text: string): ParseExportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: "The file is not valid JSON.", details: String(error) };
  }
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "The file does not contain an export object." };
  }
  const envelope = raw as Record<string, unknown>;
  if (envelope.format !== EXPORT_FORMAT) {
    return { ok: false, error: "This is not a Coding Challenge Lab export." };
  }
  if (typeof envelope.version !== "number") {
    return { ok: false, error: "The export has no version number." };
  }
  if (envelope.version > EXPORT_VERSION) {
    return {
      ok: false,
      error: `This export was created by a newer version of the app (format v${envelope.version}). Update the app to import it.`,
    };
  }
  const migrated = migrateExport(envelope);
  const rawAttempts = Array.isArray(migrated.attempts) ? migrated.attempts : [];
  const attempts = rawAttempts.flatMap((a: unknown) => {
    const parsed = AttemptSchema.safeParse(a);
    return parsed.success ? [parsed.data] : [];
  });
  const result = ExportFileSchema.safeParse({ ...migrated, attempts });
  if (!result.success) {
    return {
      ok: false,
      error: "The export file is malformed.",
      details: z.prettifyError(result.error),
    };
  }
  return { ok: true, file: result.data, skipped: rawAttempts.length - attempts.length };
}

/** Upgrade older envelopes step by step. v1 is the first version, so this is the identity today. */
function migrateExport(envelope: Record<string, unknown>): Record<string, unknown> {
  return envelope;
}

export type DuplicateStrategy = "skip" | "overwrite" | "newest";

export interface MergePlan {
  toWrite: Attempt[];
  added: number;
  updated: number;
  skipped: number;
}

export function planImport(
  incoming: readonly Attempt[],
  existing: ReadonlyMap<string, Attempt>,
  strategy: DuplicateStrategy,
): MergePlan {
  const plan: MergePlan = { toWrite: [], added: 0, updated: 0, skipped: 0 };
  for (const attempt of incoming) {
    const current = existing.get(attempt.id);
    if (!current) {
      plan.toWrite.push(attempt);
      plan.added++;
    } else if (
      strategy === "overwrite" ||
      (strategy === "newest" && attempt.updatedAt > current.updatedAt)
    ) {
      plan.toWrite.push(attempt);
      plan.updated++;
    } else {
      plan.skipped++;
    }
  }
  return plan;
}
