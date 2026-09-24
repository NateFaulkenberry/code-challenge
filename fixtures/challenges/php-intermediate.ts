import { defineFixture } from "./define";

export default defineFixture({
  title: "Registration Payload Validator",
  language: "php",
  difficulty: "intermediate",
  category: "apis",
  archetype: "implementation",
  summary:
    "Validate an incoming registration payload and return structured, field-level errors an API client can render.",
  problemStatement: `The signup endpoint receives a decoded JSON payload as an associative array. Today it fails on the first problem with a generic message, so clients can't highlight the offending fields.

Implement \`validate_registration(array $payload): array\` returning \`['valid' => bool, 'errors' => array<string, list<string>>]\`, where \`errors\` maps each field name to **all** of its problems.`,
  realWorldContext:
    "Form-heavy APIs return field-level error maps (like Laravel's validator) so clients can show every problem at once.",
  requirements: [
    "`email` is required and must be a valid email address (use `filter_var` with `FILTER_VALIDATE_EMAIL`). Error codes: `required`, `invalid_email`.",
    "`password` is required, at least 12 characters, and must contain a digit and an uppercase letter. Codes: `required`, `too_short`, `missing_digit`, `missing_uppercase` — report every failing rule.",
    "`age` is optional; when present it must be an integer (or integer string) between 13 and 120. Codes: `not_integer`, `out_of_range`.",
    "`username` is required, 3–20 characters of letters, digits and underscores. Codes: `required`, `invalid_format`.",
    "Strings are trimmed before validation; a blank string counts as missing (`required`).",
    "Only include fields that have errors; `valid` is true exactly when `errors` is empty.",
  ],
  constraints: [
    "No frameworks or Composer packages.",
    "Do not throw for invalid input — invalid input is an expected case.",
  ],
  starterCode: `<?php

declare(strict_types=1);

function validate_registration(array $payload): array
{
    $errors = [];
    // TODO: validate email, password, age and username
    return ['valid' => true, 'errors' => $errors];
}
`,
  referenceSolution: `<?php

declare(strict_types=1);

function validate_registration(array $payload): array
{
    $errors = [];
    $value = static function (string $field) use ($payload): ?string {
        if (!array_key_exists($field, $payload) || $payload[$field] === null) {
            return null;
        }
        $trimmed = trim((string) $payload[$field]);
        return $trimmed === '' ? null : $trimmed;
    };
    $add = static function (string $field, string $code) use (&$errors): void {
        $errors[$field][] = $code;
    };

    $email = $value('email');
    if ($email === null) {
        $add('email', 'required');
    } elseif (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $add('email', 'invalid_email');
    }

    $password = $value('password');
    if ($password === null) {
        $add('password', 'required');
    } else {
        if (strlen($password) < 12) $add('password', 'too_short');
        if (!preg_match('/\\d/', $password)) $add('password', 'missing_digit');
        if (!preg_match('/[A-Z]/', $password)) $add('password', 'missing_uppercase');
    }

    $age = $value('age');
    if ($age !== null) {
        if (!preg_match('/^-?\\d+$/', $age)) {
            $add('age', 'not_integer');
        } elseif ((int) $age < 13 || (int) $age > 120) {
            $add('age', 'out_of_range');
        }
    }

    $username = $value('username');
    if ($username === null) {
        $add('username', 'required');
    } elseif (!preg_match('/^\\w{3,20}$/', $username)) {
        $add('username', 'invalid_format');
    }

    return ['valid' => $errors === [], 'errors' => $errors];
}
`,
  explanation:
    "Two small closures keep the rules readable: one normalizes a field (trim, blank → missing) and one appends an error code. Each field's rules run independently so all problems are collected, and password rules deliberately don't short-circuit. `valid` is derived from the error map rather than tracked separately, so the two can't disagree.",
  complexity: { time: "O(n) in payload size", space: "O(e) for e errors" },
  tests: {
    prelude: ``,
    cases: [
      {
        id: "valid-payload",
        name: "accepts a valid payload",
        hidden: false,
        code: `$result = validate_registration(['email' => 'ada@example.com', 'password' => 'Correct horse 42', 'username' => 'ada_l']);\nassert_same(['valid' => true, 'errors' => []], $result);`,
      },
      {
        id: "required-fields",
        name: "reports every missing required field",
        hidden: false,
        code: `$result = validate_registration([]);\nassert_false($result['valid']);\nassert_equals(['required'], $result['errors']['email']);\nassert_equals(['required'], $result['errors']['password']);\nassert_equals(['required'], $result['errors']['username']);\nassert_true(!isset($result['errors']['age']));`,
      },
      {
        id: "password-rules",
        name: "reports all failing password rules",
        hidden: false,
        code: `$result = validate_registration(['email' => 'a@b.co', 'password' => 'short', 'username' => 'abc']);\nassert_same(['too_short', 'missing_digit', 'missing_uppercase'], $result['errors']['password']);`,
      },
      {
        id: "invalid-email",
        name: "rejects malformed emails",
        hidden: false,
        code: `$result = validate_registration(['email' => 'not-an-email', 'password' => 'Correct horse 42', 'username' => 'abc']);\nassert_same(['email' => ['invalid_email']], $result['errors']);`,
      },
      {
        id: "age-rules",
        name: "validates optional age",
        hidden: true,
        code: `$base = ['email' => 'a@b.co', 'password' => 'Correct horse 42', 'username' => 'abc'];\nassert_same(['not_integer'], validate_registration($base + ['age' => '12.5'])['errors']['age']);\nassert_same(['out_of_range'], validate_registration($base + ['age' => 12])['errors']['age']);\nassert_true(validate_registration($base + ['age' => '30'])['valid']);`,
      },
      {
        id: "blank-is-missing",
        name: "treats blank strings as missing after trimming",
        hidden: true,
        code: `$result = validate_registration(['email' => '   ', 'password' => 'Correct horse 42', 'username' => '  abc  ']);\nassert_same(['email' => ['required']], $result['errors']);`,
      },
      {
        id: "username-format",
        name: "rejects usernames with invalid characters or length",
        hidden: true,
        code: `$base = ['email' => 'a@b.co', 'password' => 'Correct horse 42'];\nassert_same(['invalid_format'], validate_registration($base + ['username' => 'ab'])['errors']['username']);\nassert_same(['invalid_format'], validate_registration($base + ['username' => 'bad-name!'])['errors']['username']);`,
      },
    ],
  },
  expectedConcepts: [
    "associative arrays",
    "validation",
    "regular expressions",
    "closures",
    "structured errors",
  ],
  estimatedTimeMinutes: 30,
});
