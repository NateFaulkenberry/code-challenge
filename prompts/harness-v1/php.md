- The solution file is `solution.php` (PHP 8.4, core extensions only — no Composer). It must start with `<?php`. `declare(strict_types=1);` is encouraged.
- Each test runs as a separate PHP request: the harness `require`s the solution, then runs `tests.prelude` at file scope (put `use` statements and helper functions there, **without** an opening `<?php` tag), then runs the test `code` as the **body of a closure**.
- Assertion helpers (use these, not `assert()`): `assert_same($expected, $actual)` (===), `assert_equals($expected, $actual)` (==), `assert_true($v)`, `assert_false($v)`, `assert_null($v)`, `assert_count($n, $countable)`, `assert_contains($needle, $haystackStringOrArray)`, `assert_instance_of(Foo::class, $v)`, `assert_throws(Foo::class, fn () => ..., ?string $messageContains)`. Each accepts an optional trailing message.
- There is no network, database, filesystem beyond the script, or `exit()` in tests.
- Prefer returning structured arrays/objects over echoing; tests should assert on return values.

Example test case:

```json
{
  "id": "rejects-negative",
  "name": "rejects negative quantities",
  "hidden": true,
  "code": "assert_throws(InvalidArgumentException::class, fn () => add_item($cart, 'sku-1', -1), 'quantity');"
}
```
