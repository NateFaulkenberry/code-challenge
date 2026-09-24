import { z } from "zod";

export const LANGUAGE_IDS = ["typescript", "react", "python", "php", "c", "cpp", "java"] as const;

export const LanguageIdSchema = z.enum(LANGUAGE_IDS);
export type LanguageId = z.infer<typeof LanguageIdSchema>;

export interface LanguageDefinition {
  id: LanguageId;
  label: string;
  /** Short label for badges and dense tables. */
  shortLabel: string;
  /** File name of the user's solution inside the runtime. */
  solutionFile: string;
  runtimeSummary: string;
  capabilities: {
    /** Renders a live, sandboxed preview next to the output. */
    preview: boolean;
  };
  /**
   * Hard constraints of the browser runtime. Shown in the UI and fed to the
   * challenge generator so it never asks for something the runtime can't do.
   */
  constraints: readonly string[];
  maturity: "stable" | "experimental";
}

/**
 * The single source of truth for supported languages. Anything that needs a
 * per-language value keys a `Record<LanguageId, …>` so the compiler enforces
 * exhaustiveness when a language is added.
 */
export const LANGUAGES: Readonly<Record<LanguageId, LanguageDefinition>> = {
  typescript: {
    id: "typescript",
    label: "TypeScript",
    shortLabel: "TS",
    solutionFile: "solution.ts",
    runtimeSummary: "Transpiled with sucrase, executed in an isolated Web Worker.",
    capabilities: { preview: false },
    constraints: [
      "No DOM, network, timers beyond setTimeout/setInterval/queueMicrotask, or storage APIs.",
      "No npm packages; only the ECMAScript standard library.",
      "Types are erased, not checked, at run time.",
    ],
    maturity: "stable",
  },
  react: {
    id: "react",
    label: "React",
    shortLabel: "React",
    solutionFile: "solution.tsx",
    runtimeSummary: "React 19 rendered in a sandboxed, opaque-origin iframe.",
    capabilities: { preview: true },
    constraints: [
      "Only `react` and `react-dom` may be imported.",
      "The solution must `export default` the component under test.",
      "No network access; simulate async work with Promises and timers.",
    ],
    maturity: "stable",
  },
  python: {
    id: "python",
    label: "Python",
    shortLabel: "Py",
    solutionFile: "solution.py",
    runtimeSummary: "CPython 3.14 via Pyodide (WebAssembly) in a Web Worker.",
    capabilities: { preview: false },
    constraints: [
      "Standard library only — no third-party packages.",
      "No threads, subprocesses, sockets or blocking input().",
    ],
    maturity: "stable",
  },
  php: {
    id: "php",
    label: "PHP",
    shortLabel: "PHP",
    solutionFile: "solution.php",
    runtimeSummary: "PHP 8.4 compiled to WebAssembly (php-wasm) in a Web Worker.",
    capabilities: { preview: false },
    constraints: ["Core PHP only — no Composer packages, network or database extensions."],
    maturity: "experimental",
  },
  c: {
    id: "c",
    label: "C",
    shortLabel: "C",
    solutionFile: "solution.c",
    runtimeSummary: "Clang 22 compiled to WebAssembly, C17, run on a WASI shim.",
    capabilities: { preview: false },
    constraints: [
      "C17 with the wasi-libc standard library.",
      "No threads (pthreads), signals, sockets or filesystem beyond stdio.",
    ],
    maturity: "experimental",
  },
  cpp: {
    id: "cpp",
    label: "C++",
    shortLabel: "C++",
    solutionFile: "solution.cpp",
    runtimeSummary: "Clang 22 + libc++, C++20, run on a WASI shim.",
    capabilities: { preview: false },
    constraints: [
      "C++20 with libc++.",
      "Exceptions are unavailable (-fno-exceptions): report errors with return values, std::optional or std::expected-style types.",
      "No std::thread, sockets or filesystem beyond stdio.",
    ],
    maturity: "experimental",
  },
  java: {
    id: "java",
    label: "Java",
    shortLabel: "Java",
    solutionFile: "Solution.java",
    runtimeSummary: "javac 21 + TeaVM compiled to WebAssembly GC in a Web Worker.",
    capabilities: { preview: false },
    constraints: [
      "TeaVM class library subset: java.lang, java.util collections/streams, java.util.function.",
      "No threads, reflection-heavy code, java.io files, or java.net.",
    ],
    maturity: "experimental",
  },
};

export const LANGUAGE_LIST: readonly LanguageDefinition[] = LANGUAGE_IDS.map((id) => LANGUAGES[id]);

export function getLanguage(id: LanguageId): LanguageDefinition {
  return LANGUAGES[id];
}
