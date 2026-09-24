import type { LanguageId } from "@/domain/languages";

interface Rule {
  pattern: RegExp;
  message: string;
}

const importSpecifiers =
  /(?:import\s[^"'`]*?from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["'`]([^"'`]+)["'`]/g;

function checkJsImports(code: string, allowed: readonly string[]): string[] {
  const problems: string[] = [];
  for (const match of code.matchAll(importSpecifiers)) {
    const specifier = match[1] ?? "";
    if (!allowed.includes(specifier))
      problems.push(
        `imports "${specifier}", which is not available (allowed: ${allowed.join(", ")})`,
      );
  }
  return problems;
}

const RULES: Readonly<Record<LanguageId, { solution: Rule[]; any: Rule[] }>> = {
  typescript: {
    solution: [],
    any: [
      {
        pattern: /\bfetch\s*\(|\bnew\s+XMLHttpRequest\b|\blocalStorage\./,
        message: "uses network or storage APIs that the TypeScript runtime does not provide",
      },
    ],
  },
  react: {
    solution: [
      {
        pattern: /\bfetch\s*\(/,
        message: "calls fetch(); inject async data sources as props instead",
      },
    ],
    any: [],
  },
  python: {
    solution: [],
    any: [
      {
        pattern:
          /^\s*(?:import|from)\s+(numpy|pandas|requests|scipy|httpx|aiohttp|flask|django|pytest)\b/m,
        message: "imports a third-party package; only the standard library is available",
      },
      {
        pattern: /^\s*(?:import|from)\s+(threading|multiprocessing|subprocess|socket)\b/m,
        message: "uses threads, processes or sockets, which Pyodide cannot run",
      },
      {
        pattern: /\binput\s*\(/,
        message: "reads interactive input(), which blocks in the browser",
      },
    ],
  },
  php: {
    solution: [],
    any: [
      {
        pattern: /\b(curl_\w+|fsockopen|mysqli\w*|new\s+PDO|file_get_contents\s*\(\s*["']https?:)/,
        message: "uses network or database functions unavailable in php-wasm",
      },
    ],
  },
  c: {
    solution: [],
    any: [
      {
        pattern: /#\s*include\s*<(pthread|sys\/socket|signal|threads)\.h>/,
        message: "includes threading, signal or socket headers unavailable under WASI",
      },
    ],
  },
  cpp: {
    solution: [],
    any: [
      {
        pattern: /\b(throw|try)\b|\bcatch\s*\(/,
        message:
          "uses C++ exceptions, which the runtime does not support (compiled with -fno-exceptions)",
      },
      {
        pattern: /#\s*include\s*<(thread|future|mutex|condition_variable|pthread\.h|filesystem)>/,
        message: "includes threading/filesystem headers unavailable under WASI",
      },
    ],
  },
  java: {
    solution: [],
    any: [
      {
        pattern: /\bnew\s+Thread\b|java\.util\.concurrent|\bsynchronized\b|ExecutorService/,
        message: "uses threads/concurrency APIs, which TeaVM does not support",
      },
      {
        pattern: /java\.net\.|java\.io\.File\b|java\.nio\.file|java\.lang\.reflect|Class\.forName/,
        message: "uses file, network or reflection APIs unavailable in TeaVM",
      },
      {
        pattern: /new\s+Scanner\s*\(\s*System\.in/,
        message: "reads System.in, which is not available",
      },
    ],
  },
};

const JS_ALLOWED: Partial<Record<LanguageId, { solution: string[]; tests: string[] }>> = {
  typescript: { solution: [], tests: ["./solution"] },
  react: {
    solution: ["react"],
    tests: ["./solution", "react", "@testing-library/react", "@testing-library/user-event"],
  },
};

/** Static checks that reject code the chosen runtime cannot execute. */
export function checkLanguageRules(
  language: LanguageId,
  code: { solution: string; starter: string; tests: string },
): string[] {
  const problems: string[] = [];
  const rules = RULES[language];
  const sources = [
    ["reference solution", code.solution],
    ["starter code", code.starter],
    ["tests", code.tests],
  ] as const;
  for (const [label, source] of sources) {
    for (const rule of rules.any)
      if (rule.pattern.test(source)) problems.push(`The ${label} ${rule.message}.`);
    if (label !== "tests")
      for (const rule of rules.solution)
        if (rule.pattern.test(source)) problems.push(`The ${label} ${rule.message}.`);
    const allowed = JS_ALLOWED[language];
    if (allowed) {
      for (const problem of checkJsImports(
        source,
        label === "tests" ? allowed.tests : allowed.solution,
      )) {
        problems.push(`The ${label} ${problem}.`);
      }
    }
  }
  return [...new Set(problems)];
}
