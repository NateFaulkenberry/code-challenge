- The solution file is `solution.c`, compiled as **C17** with clang to WebAssembly (WASI). Standard headers from wasi-libc are available (`stdio.h`, `stdlib.h`, `string.h`, `stdint.h`, `stdbool.h`, `math.h`, …). No threads, signals, sockets or files.
- Tests are compiled in the same translation unit, after `#include "solution.c"`. A `main()` in the solution is fine (it is renamed during tests), but not required.
- `tests.prelude` is placed at file scope after the solution: use it for helper functions and extra `#include`s. It must be valid C.
- Each test `code` is the **body of a `void` function**. Use only these assertion macros (they `return` on failure, so call them directly in the test body, not inside helpers):
  `CHECK(cond)`, `CHECK_EQ_INT(actual, expected)`, `CHECK_EQ_STR(actual, expected)`, `CHECK_NEAR(actual, expected, eps)`.
- Every test runs in a fresh process instance: globals are reset between tests, and a crash only fails that test.
- Prefer caller-owned memory APIs; if the solution allocates, provide a matching free function and call it in tests.

Example test case:

```json
{
  "id": "parses-negative",
  "name": "parses negative numbers",
  "hidden": false,
  "code": "int value = 0;\nCHECK(parse_int(\"-42\", &value));\nCHECK_EQ_INT(value, -42);"
}
```
