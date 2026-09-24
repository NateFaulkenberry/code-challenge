/** `new Function` wraps the body as "function anonymous(…\n) {\n<body>". */
export const FUNCTION_HEADER_LINES = 2;

export type RequireFn = (specifier: string) => unknown;

export class ModuleNotFoundError extends Error {
  constructor(specifier: string, available: readonly string[]) {
    super(
      `Cannot import "${specifier}". Available modules: ${available.length ? available.map((m) => `"${m}"`).join(", ") : "none"}.`,
    );
    this.name = "ModuleNotFoundError";
  }
}

/** A `require` that only resolves an explicit allow-list of modules. */
export function createRequire(modules: Readonly<Record<string, () => unknown>>): RequireFn {
  const cache = new Map<string, unknown>();
  return (specifier) => {
    const key = specifier.replace(/\.(tsx?|jsx?)$/, "");
    const factory = modules[key];
    if (!factory) throw new ModuleNotFoundError(specifier, Object.keys(modules));
    if (!cache.has(key)) cache.set(key, factory());
    return cache.get(key);
  };
}

/**
 * Evaluates transpiled CommonJS code with explicit bindings. `new Function`
 * runs in the *current realm*, so callers must only use this inside an
 * isolated worker or sandboxed iframe — never in the application window.
 */
export function evaluateModule(
  code: string,
  fileName: string,
  require: RequireFn,
  bindings: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const names = Object.keys(bindings);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- deliberate: this is the sandboxed evaluator.
  const factory = new Function(
    "module",
    "exports",
    "require",
    ...names,
    // "use strict" shares line 1 with the code so user line numbers only shift
    // by the two header lines `new Function` adds (see FUNCTION_HEADER_LINES).
    `"use strict";${code}\n//# sourceURL=${fileName}`,
  ) as (...args: unknown[]) => void;
  factory(module, module.exports, require, ...names.map((name) => bindings[name]));
  return module.exports;
}
