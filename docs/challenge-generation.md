# Challenge Generation

Challenges are generated on demand by an LLM, then validated before the app accepts them ([ADR-004](adr/004-challenge-generation-architecture.md), [ADR-009](adr/009-llm-provider-architecture.md)).

## Sources

| Source               | When                      | Notes                                                                                                                                                                                    |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anthropic (BYOK)** | The user adds an API key  | Direct browser call to `/v1/messages` with `anthropic-dangerous-direct-browser-access: true` and JSON-schema structured output. Default model `claude-opus-5-5`, selectable in Settings. |
| **Proxy**            | The user configures a URL | POSTs `{ system, messages, jsonSchema, promptVersion }` and expects `{ text, model }`. For deployments that keep the key server-side. None ships with the app.                           |
| **Samples**          | Default, and offline      | The bundled fixtures, served as authored (never relabelled). Choosing one again reopens the existing attempt.                                                                            |

## Pipeline (LLM sources)

1. **Resolve the request.** Missing language and difficulty are chosen at random. Category and archetype come from the language's affinity list, weighted `1 / (1 + recent uses)` against the user's history in that language.
2. **Build the prompt** from `prompts/challenge-generator-v1.md` plus `prompts/harness-v1/<language>.md`. The prompt includes difficulty expectations, runtime constraints, test design rules and up to 30 recent titles to avoid.
3. **Call the provider** with a JSON Schema derived from the Zod `ChallengeDraftSchema`. Keywords that structured-output engines commonly reject (length and pattern limits) are stripped, and Zod enforces them afterwards. Transient errors (429, 5xx, network) are retried once.
4. **Parse** tolerantly: raw JSON, fenced JSON, or the first balanced object in prose.
5. **Validate schema and semantics:** requested language, difficulty, category and archetype are echoed exactly; test ids are unique; at least one visible and one hidden test; starter ≠ reference; static language rules (allowed imports, no exceptions in C++, no third-party Python, no threads in Java, …).
6. **Check for duplicates:** Jaccard similarity over a normalised token fingerprint (title tokens weighted, stop words removed, light stemming) against every stored challenge; at least 0.6 is rejected.
7. **Validate at runtime,** in the same browser runtime users get: the reference must pass **every** test, and the starter must compile and run without passing every test.
8. **Repair:** any failure sends the model its previous output plus a `challenge-repair-v1` prompt listing the exact problems. There are at most three attempts, after which the user sees the final problems.
9. **Accept:** the app assigns `id`, `slug` and `fingerprint`, and records provenance (`source`, `generatorVersion`, `model`, `generatedAt`).

## Difficulty

Difficulty describes the reasoning demanded, not the length. Each level defines its concepts, what makes it harder, and a time range (`src/domain/difficulty.ts`). For example, _Advanced_ requires "interacting requirements that constrain each other", and _Expert_ requires "insight, not just diligence".

## Prompt versioning

Prompts live in source control. Their version (`challenge-generator-v1`) is stored on every generated challenge, so results can be traced to the prompt that produced them. Changing a prompt's behaviour means adding a `-v2` file and bumping `GENERATOR_VERSION`.
