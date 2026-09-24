<?php
// Coding Challenge Lab — PHP test harness. Each test runs as its own PHP
// request (fresh functions, classes and globals) and reports one protocol line.

if (!defined('STDIN')) define('STDIN', fopen('php://stdin', 'r'));
if (!defined('STDOUT')) define('STDOUT', fopen('php://stdout', 'w'));
if (!defined('STDERR')) define('STDERR', fopen('php://stderr', 'w'));

final class CclAssertionError extends Exception {}

function __ccl_export(mixed $value): string
{
    $text = var_export($value, true);
    return strlen($text) > 500 ? substr($text, 0, 500) . '…' : $text;
}

function __ccl_fail(string $default, string $message): never
{
    throw new CclAssertionError($message !== '' ? $message . "\n" . $default : $default);
}

/** Loose equality (==): same values, types may differ; arrays compared by key/value. */
function assert_equals(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected != $actual) __ccl_fail('Expected ' . __ccl_export($expected) . ', got ' . __ccl_export($actual), $message);
}

/** Strict identity (===). */
function assert_same(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) __ccl_fail('Expected (===) ' . __ccl_export($expected) . ', got ' . __ccl_export($actual), $message);
}

function assert_true(mixed $value, string $message = ''): void
{
    if ($value !== true) __ccl_fail('Expected true, got ' . __ccl_export($value), $message);
}

function assert_false(mixed $value, string $message = ''): void
{
    if ($value !== false) __ccl_fail('Expected false, got ' . __ccl_export($value), $message);
}

function assert_null(mixed $value, string $message = ''): void
{
    if ($value !== null) __ccl_fail('Expected null, got ' . __ccl_export($value), $message);
}

function assert_count(int $expected, Countable|array $value, string $message = ''): void
{
    if (count($value) !== $expected) __ccl_fail("Expected count $expected, got " . count($value), $message);
}

function assert_contains(mixed $needle, string|array $haystack, string $message = ''): void
{
    $found = is_string($haystack) ? str_contains($haystack, (string) $needle) : in_array($needle, $haystack, true);
    if (!$found) __ccl_fail('Expected ' . __ccl_export($haystack) . ' to contain ' . __ccl_export($needle), $message);
}

function assert_instance_of(string $class, mixed $value, string $message = ''): void
{
    if (!($value instanceof $class)) __ccl_fail("Expected an instance of $class, got " . get_debug_type($value), $message);
}

function assert_throws(string $class, callable $fn, ?string $messageContains = null): Throwable
{
    try {
        $fn();
    } catch (Throwable $e) {
        if (!($e instanceof $class)) __ccl_fail("Expected $class to be thrown, got " . $e::class . ': ' . $e->getMessage(), '');
        if ($messageContains !== null && !str_contains($e->getMessage(), $messageContains)) {
            __ccl_fail("Expected the exception message to contain '$messageContains', got '" . $e->getMessage() . "'", '');
        }
        return $e;
    }
    __ccl_fail("Expected $class to be thrown, but nothing was thrown", '');
}

function __ccl_report(string $nonce, array $record): void
{
    echo "\n\x1eCCL:" . $nonce . ':' . json_encode($record, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . "\n";
}

function __ccl_run(string $nonce, string $id, callable $test): void
{
    $started = hrtime(true);
    $elapsed = static fn () => (hrtime(true) - $started) / 1e6;
    try {
        $test();
        __ccl_report($nonce, ['id' => $id, 'status' => 'pass', 'durationMs' => $elapsed()]);
    } catch (CclAssertionError $e) {
        __ccl_report($nonce, ['id' => $id, 'status' => 'fail', 'message' => $e->getMessage(), 'durationMs' => $elapsed()]);
    } catch (Throwable $e) {
        $where = basename($e->getFile()) . ':' . $e->getLine();
        __ccl_report($nonce, ['id' => $id, 'status' => 'error', 'message' => $e::class . ': ' . $e->getMessage() . " ($where)", 'durationMs' => $elapsed()]);
    }
}
