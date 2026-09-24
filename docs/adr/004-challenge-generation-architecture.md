# ADR-004: Challenge Generation Architecture

## Status

Accepted — 2026-09-23

## Context

Challenges must be effectively unlimited, so a hard-coded pool is not acceptable. LLM output is untrusted, can be malformed, can mismatch the request, or can contain broken tests.

## Decision

A staged pipeline, each stage independently testable:

1. **Request resolution**: missing parameters are filled randomly. Category and archetype selection is weighted away from the user's recent history to avoid convergence.
2. **Prompt building**: versioned prompt templates in `/prompts/*.md`, imported as raw text. The prompt version is recorded in `challenge.provenance.generatorVersion`.
3. **Provider**: an `LlmProvider` returns raw text or JSON (see [ADR-009](009-llm-provider-architecture.md)).
4. **Parse and schema validation**: Zod. The JSON Schema sent to the model is generated from the same Zod schema.
5. **Semantic validation**: requested language and difficulty match, tests have unique ids, at least one visible and one hidden test, no disallowed imports/APIs per language, size limits.
6. **Duplicate detection**: a normalised token-set fingerprint over title, statement and requirements, compared by Jaccard similarity against stored challenges.
7. **Runtime validation**: in the same browser runtime that runs user code, the reference solution must pass every test, and the starter code must run without crashing the harness but must _not_ pass every test.
8. **Retry**: on failure the validator's findings go back to the model, up to a bounded number of attempts.

## Alternatives Considered

- **Template-based generator** (parameterised problem families). Deterministic, but produces a finite, recognisable space. It is kept only as fixtures for tests.
- **Trust the model's structured output.** Schema-valid does not mean correct. Running the reference solution is the only real check.

## Consequences

- Generation takes the LLM time plus a validation run, and the UI reports each stage.
- C/C++/Java validation needs their toolchains, so generating such a challenge triggers the runtime download.
- Fixtures go through the same validator in CI, so the pipeline is exercised without network access.
