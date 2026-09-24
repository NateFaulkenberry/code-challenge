import { formatValue } from "../core/output";

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

/** Structural equality in the spirit of Jest's `toEqual` (undefined properties are ignored). */
export function deepEqual(a: unknown, b: unknown, seen = new Map<object, object>()): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (seen.get(a) === b) return true;
  seen.set(a, b);

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (a instanceof RegExp || b instanceof RegExp) {
    return a instanceof RegExp && b instanceof RegExp && a.toString() === b.toString();
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key), seen)) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value) && ![...b].some((other) => deepEqual(value, other, seen))) return false;
    }
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => deepEqual(value, b[i], seen));
  }
  const keysA = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const keysB = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], seen),
  );
}

const show = (value: unknown) => formatValue(value, new WeakSet(), 1);

type Matchers = {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toStrictEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeNaN(): void;
  toBeGreaterThan(n: number): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThan(n: number): void;
  toBeLessThanOrEqual(n: number): void;
  toBeCloseTo(n: number, digits?: number): void;
  toContain(item: unknown): void;
  toContainEqual(item: unknown): void;
  toHaveLength(n: number): void;
  toHaveProperty(path: string, value?: unknown): void;
  toMatch(pattern: RegExp | string): void;
  toBeInstanceOf(ctor: abstract new (...args: never[]) => unknown): void;
  toThrow(expected?: string | RegExp | (new (...args: never[]) => Error)): void;
  toHaveBeenCalled(): void;
  toHaveBeenCalledTimes(n: number): void;
  toHaveBeenCalledWith(...args: unknown[]): void;
  /* DOM matchers (React sandbox) */
  toBeInTheDocument(): void;
  toHaveTextContent(text: string | RegExp): void;
  toHaveValue(value: unknown): void;
  toBeDisabled(): void;
  toBeVisible(): void;
  toHaveAttribute(name: string, value?: string): void;
};

type AsyncMatchers = { [K in keyof Matchers]: (...args: Parameters<Matchers[K]>) => Promise<void> };

export type Expectation = Matchers & {
  not: Matchers;
  resolves: AsyncMatchers & { not: AsyncMatchers };
  rejects: AsyncMatchers & { not: AsyncMatchers };
};

interface MockFunction {
  (...args: unknown[]): unknown;
  mock: { calls: unknown[][] };
}

function isMock(value: unknown): value is MockFunction {
  return typeof value === "function" && "mock" in value;
}

function thrownBy(fn: unknown): { threw: boolean; error: unknown } {
  if (typeof fn !== "function") throw new AssertionError("toThrow() expects a function");
  try {
    (fn as () => unknown)();
    return { threw: false, error: undefined };
  } catch (error) {
    return { threw: true, error };
  }
}

function checks(actual: unknown): Record<keyof Matchers, (...args: never[]) => [boolean, string]> {
  const element = actual as Element & { value?: unknown; disabled?: boolean };
  return {
    toBe: (expected: unknown) => [
      Object.is(actual, expected),
      typeof actual === "object" &&
      actual !== null &&
      typeof expected === "object" &&
      expected !== null
        ? `expected the same instance, but got two different objects (${show(actual)} vs ${show(expected)}). toBe compares identity; use toEqual to compare structure`
        : `expected ${show(actual)} to be ${show(expected)}`,
    ],
    toEqual: (expected: unknown) => [
      deepEqual(actual, expected),
      `expected ${show(actual)} to equal ${show(expected)}`,
    ],
    toStrictEqual: (expected: unknown) => [
      deepEqual(actual, expected),
      `expected ${show(actual)} to strictly equal ${show(expected)}`,
    ],
    toBeTruthy: () => [Boolean(actual), `expected ${show(actual)} to be truthy`],
    toBeFalsy: () => [!actual, `expected ${show(actual)} to be falsy`],
    toBeNull: () => [actual === null, `expected ${show(actual)} to be null`],
    toBeUndefined: () => [actual === undefined, `expected ${show(actual)} to be undefined`],
    toBeDefined: () => [actual !== undefined, `expected value to be defined`],
    toBeNaN: () => [Number.isNaN(actual), `expected ${show(actual)} to be NaN`],
    toBeGreaterThan: (n: number) => [
      (actual as number) > n,
      `expected ${show(actual)} to be > ${n}`,
    ],
    toBeGreaterThanOrEqual: (n: number) => [
      (actual as number) >= n,
      `expected ${show(actual)} to be >= ${n}`,
    ],
    toBeLessThan: (n: number) => [(actual as number) < n, `expected ${show(actual)} to be < ${n}`],
    toBeLessThanOrEqual: (n: number) => [
      (actual as number) <= n,
      `expected ${show(actual)} to be <= ${n}`,
    ],
    toBeCloseTo: (n: number, digits = 2) => [
      Math.abs((actual as number) - n) < 10 ** -digits / 2,
      `expected ${show(actual)} to be close to ${n}`,
    ],
    toContain: (item: unknown) => [
      typeof actual === "string"
        ? actual.includes(item as string)
        : Array.isArray(actual) && actual.includes(item),
      `expected ${show(actual)} to contain ${show(item)}`,
    ],
    toContainEqual: (item: unknown) => [
      Array.isArray(actual) && actual.some((v) => deepEqual(v, item)),
      `expected ${show(actual)} to contain an item equal to ${show(item)}`,
    ],
    toHaveLength: (n: number) => [
      (actual as { length?: unknown } | null)?.length === n,
      `expected length ${show((actual as { length?: unknown } | null)?.length)} to be ${n}`,
    ],
    toHaveProperty: (path: string, ...rest: unknown[]) => {
      let current: unknown = actual;
      for (const key of path.split(".")) {
        if (current === null || current === undefined || !(key in Object(current))) {
          return [false, `expected ${show(actual)} to have property "${path}"`];
        }
        current = (current as Record<string, unknown>)[key];
      }
      return rest.length === 0
        ? [true, `expected ${show(actual)} not to have property "${path}"`]
        : [
            deepEqual(current, rest[0]),
            `expected property "${path}" to equal ${show(rest[0])}, got ${show(current)}`,
          ];
    },
    toMatch: (pattern: RegExp | string) => [
      typeof actual === "string" &&
        (typeof pattern === "string" ? actual.includes(pattern) : pattern.test(actual)),
      `expected ${show(actual)} to match ${String(pattern)}`,
    ],
    toBeInstanceOf: (ctor: abstract new (...args: never[]) => unknown) => [
      actual instanceof ctor,
      `expected value to be an instance of ${ctor.name}`,
    ],
    toThrow: (expected?: string | RegExp | (new (...args: never[]) => Error)) => {
      const { threw, error } = thrownBy(actual);
      if (!threw) return [false, "expected function to throw"];
      const message = error instanceof Error ? error.message : String(error);
      if (expected === undefined)
        return [true, `expected function not to throw, but it threw "${message}"`];
      if (typeof expected === "string")
        return [message.includes(expected), `expected error "${message}" to include "${expected}"`];
      if (expected instanceof RegExp)
        return [expected.test(message), `expected error "${message}" to match ${String(expected)}`];
      return [error instanceof expected, `expected error to be an instance of ${expected.name}`];
    },
    toHaveBeenCalled: () => [
      isMock(actual) && actual.mock.calls.length > 0,
      "expected mock to have been called",
    ],
    toHaveBeenCalledTimes: (n: number) => [
      isMock(actual) && actual.mock.calls.length === n,
      `expected mock to be called ${n} times, got ${isMock(actual) ? actual.mock.calls.length : "n/a"}`,
    ],
    toHaveBeenCalledWith: (...args: unknown[]) => [
      isMock(actual) && actual.mock.calls.some((call) => deepEqual(call, args)),
      `expected mock to have been called with ${show(args)}`,
    ],
    toBeInTheDocument: () => [
      typeof Node !== "undefined" && actual instanceof Node && actual.isConnected,
      "expected element to be in the document",
    ],
    toHaveTextContent: (text: string | RegExp) => {
      const content = (element as Node | null)?.textContent ?? "";
      return [
        typeof text === "string" ? content.includes(text) : text.test(content),
        `expected text content ${show(content)} to match ${show(text)}`,
      ];
    },
    toHaveValue: (value: unknown) => [
      deepEqual(element.value, value),
      `expected value ${show(element.value)} to be ${show(value)}`,
    ],
    toBeDisabled: () => [element.disabled === true, "expected element to be disabled"],
    toBeVisible: () => {
      if (typeof getComputedStyle === "undefined" || !(actual instanceof Element))
        return [false, "expected an element"];
      const style = getComputedStyle(actual);
      return [
        actual.isConnected && style.display !== "none" && style.visibility !== "hidden",
        "expected element to be visible",
      ];
    },
    toHaveAttribute: (name: string, ...rest: unknown[]) => [
      actual instanceof Element &&
        actual.hasAttribute(name) &&
        (rest.length === 0 || actual.getAttribute(name) === rest[0]),
      `expected element to have attribute ${name}${rest.length ? `="${String(rest[0])}"` : ""}`,
    ],
  };
}

function buildMatchers(actual: unknown, negate: boolean): Matchers {
  const table = checks(actual);
  const matchers = {} as Record<string, (...args: never[]) => void>;
  for (const [name, check] of Object.entries(table)) {
    matchers[name] = (...args: never[]) => {
      const [pass, message] = check(...args);
      if (pass === negate) {
        throw new AssertionError(
          negate ? message.replace(/^expected (.*?) to /, "expected $1 not to ") : message,
        );
      }
    };
  }
  return matchers as unknown as Matchers;
}

function buildAsync(
  promise: unknown,
  mode: "resolves" | "rejects",
  negate: boolean,
): AsyncMatchers {
  const matchers = {} as Record<string, (...args: never[]) => Promise<void>>;
  for (const name of Object.keys(checks(undefined))) {
    matchers[name] = async (...args: never[]) => {
      let value: unknown;
      try {
        value = await promise;
        if (mode === "rejects")
          throw new AssertionError(
            `expected promise to reject, but it resolved with ${show(value)}`,
          );
      } catch (error) {
        if (error instanceof AssertionError) throw error;
        if (mode === "resolves")
          throw new AssertionError(
            `expected promise to resolve, but it rejected with ${show(error)}`,
          );
        value = error;
      }
      const target =
        mode === "rejects" && name === "toThrow"
          ? () => {
              throw value;
            }
          : value;
      (buildMatchers(target, negate) as unknown as Record<string, (...a: never[]) => void>)[name]?.(
        ...args,
      );
    };
  }
  return matchers as unknown as AsyncMatchers;
}

export function expect(actual: unknown): Expectation {
  return Object.assign(buildMatchers(actual, false), {
    not: buildMatchers(actual, true),
    resolves: Object.assign(buildAsync(actual, "resolves", false), {
      not: buildAsync(actual, "resolves", true),
    }),
    rejects: Object.assign(buildAsync(actual, "rejects", false), {
      not: buildAsync(actual, "rejects", true),
    }),
  });
}

/** Minimal `jest.fn()`-style spy for tests that need to observe calls. */
export function fn(implementation?: (...args: never[]) => unknown): MockFunction {
  const calls: unknown[][] = [];
  const mock = ((...args: unknown[]) => {
    calls.push(args);
    return (implementation as ((...a: unknown[]) => unknown) | undefined)?.(...args);
  }) as MockFunction;
  mock.mock = { calls };
  return mock;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
