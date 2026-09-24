- The solution file is `solution.ts`. It is an ES module: **export** every function/class the tests use.
- `tests.prelude` runs before each test. Import from the solution with `import { name } from "./solution";`. Helper functions may be declared in the prelude.
- Each test `code` is the **body of an async function**: you may use `await`. Do not wrap it in `test(...)` or `describe(...)`.
- Assertions use a Jest-compatible `expect` global: `toBe`, `toEqual`, `toStrictEqual`, `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeGreaterThan(OrEqual)`, `toBeLessThan(OrEqual)`, `toBeCloseTo`, `toContain`, `toContainEqual`, `toHaveLength`, `toHaveProperty`, `toMatch`, `toBeInstanceOf`, `toThrow`, `.not`, `.resolves`, `.rejects`.
- `fn(impl?)` creates a spy with `toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`. `sleep(ms)` returns a Promise.
- The solution module is re-evaluated for each test, so module-level state does not leak between tests.
- Each test has a 2 second limit. There is no DOM, no `fetch`, and no npm packages.

Example test case:

```json
{
  "id": "returns-cached-value",
  "name": "returns the cached value on the second call",
  "hidden": false,
  "code": "const cache = createCache<number>();\ncache.set(\"a\", 1);\nexpect(cache.get(\"a\")).toBe(1);"
}
```
