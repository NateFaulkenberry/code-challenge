import type { LanguageId } from "@/domain/languages";
import type { LanguageRuntime } from "./core/types";
import { UnavailableRuntime } from "./unavailable";

export type RuntimeLoader = () => Promise<LanguageRuntime>;

export interface RuntimeEntry {
  /** Whether a real runtime exists. Planned entries never fake execution. */
  implemented: boolean;
  load: RuntimeLoader;
}

const planned = (language: LanguageId): RuntimeEntry => ({
  implemented: false,
  load: () =>
    Promise.resolve(
      new UnavailableRuntime(language, "This language's runtime is not available yet."),
    ),
});

/**
 * Every runtime sits behind a dynamic import, so no toolchain code is part of
 * the application shell (ADR-010). `Record<LanguageId, …>` forces an entry for
 * each language.
 */
export const RUNTIMES: Readonly<Record<LanguageId, RuntimeEntry>> = {
  typescript: {
    implemented: true,
    load: async () => (await import("./typescript")).createTypescriptRuntime(),
  },
  react: { implemented: true, load: async () => (await import("./react")).createReactRuntime() },
  python: { implemented: true, load: async () => (await import("./python")).createPythonRuntime() },
  php: { implemented: true, load: async () => (await import("./php")).createPhpRuntime() },
  c: { implemented: true, load: async () => (await import("./clang")).createCRuntime() },
  cpp: { implemented: true, load: async () => (await import("./clang")).createCppRuntime() },
  java: planned("java"),
};

export function runtimeLoaders(): Record<LanguageId, RuntimeLoader> {
  return Object.fromEntries(
    Object.entries(RUNTIMES).map(([id, entry]) => [id, entry.load]),
  ) as Record<LanguageId, RuntimeLoader>;
}

export function implementedLanguages(): LanguageId[] {
  return (Object.keys(RUNTIMES) as LanguageId[]).filter((id) => RUNTIMES[id].implemented);
}
