- The solution file is `solution.py` (CPython 3.14, standard library only). Define every function/class the tests use at module level.
- `tests.prelude` runs before each test. Import from the solution with `from solution import name`. Helper functions may be defined in the prelude.
- Each test `code` is the **body of a function** (it will be indented for you — write it at column 0). Use plain `assert` statements; prefer comparing a named variable to an expected value (`result = f(x)` then `assert result == expected`) so failures can show both values.
- The solution module is re-imported for every test, so module-level state does not leak between tests.
- There is no network, no threads/subprocesses, no `input()`, and no third-party packages (no numpy, pandas, requests, pytest).
- Deterministic only: seed any randomness, and avoid wall-clock assumptions tighter than 0.5s.

Example test case:

```json
{
  "id": "groups-by-user",
  "name": "groups events by user id",
  "hidden": false,
  "code": "result = group_events([{\"user\": 1}, {\"user\": 1}])\nassert result == {1: 2}"
}
```
