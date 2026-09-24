import type { Extension } from "@codemirror/state";
import type { LanguageId } from "@/domain/languages";

/** Language modes load on demand — each is its own chunk. */
export const EDITOR_MODES: Readonly<Record<LanguageId, () => Promise<Extension>>> = {
  typescript: async () =>
    (await import("@codemirror/lang-javascript")).javascript({ typescript: true }),
  react: async () =>
    (await import("@codemirror/lang-javascript")).javascript({ typescript: true, jsx: true }),
  python: async () => (await import("@codemirror/lang-python")).python(),
  php: async () => (await import("@codemirror/lang-php")).php({ plain: false }),
  c: async () => (await import("@codemirror/lang-cpp")).cpp(),
  cpp: async () => (await import("@codemirror/lang-cpp")).cpp(),
  java: async () => (await import("@codemirror/lang-java")).java(),
};
