- The solution file is `solution.cpp`, compiled as **C++20** with clang + libc++ to WebAssembly (WASI) with **`-fno-exceptions`**: never use `throw`, `try` or `catch`; model failures with return values, `std::optional`, or an error enum/struct. No `std::thread`, `<filesystem>`, sockets or files.
- Tests are compiled in the same translation unit, after `#include "solution.cpp"`. A `main()` in the solution is fine (it is renamed during tests), but not required.
- `tests.prelude` is placed at file scope after the solution: use it for `#include`s and helper types/functions.
- Each test `code` is the **body of a `void` function**. Use only these assertion macros (they `return` on failure, so use them directly in the test body):
  `CHECK(cond)`, `CHECK_EQ(actual, expected)` (any `==`-comparable types; values are printed when streamable), `CHECK_EQ_INT`, `CHECK_EQ_STR`, `CHECK_NEAR(actual, expected, eps)`.
- Every test runs in a fresh process instance: globals are reset between tests, and a crash only fails that test.
- Compare sizes against unsigned literals (`CHECK_EQ(v.size(), 3u)`) to avoid sign-compare warnings.

Example test case:

```json
{
  "id": "keeps-order",
  "name": "iterates in insertion order",
  "hidden": false,
  "code": "OrderedMap<std::string, int> m;\nm.insert(\"b\", 2);\nm.insert(\"a\", 1);\nCHECK_EQ(m.keys(), (std::vector<std::string>{\"b\", \"a\"}));"
}
```
