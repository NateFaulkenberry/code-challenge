# Architecture

Coding Challenge Lab is a static single-page application. Everything — challenge generation requests, code compilation, test execution and persistence — happens in the visitor's browser. See [research.md](research.md) for the feasibility evidence and [adr/](adr/) for individual decisions.

## 1. System overview

```text
┌──────────────────────────── Browser (GitHub Pages origin) ────────────────────────────┐
│                                                                                       │
│  React UI (routes, components)                                                        │
│      │  uses hooks only — no runtime/persistence details                              │
│      ▼                                                                                │
│  Feature services ──────────────┬──────────────────────┬─────────────────────────┐    │
│  (workspace, library, settings) │                      │                         │    │
│      │                          ▼                      ▼                         ▼    │
│      │                Challenge generation     Execution service         Repository   │
│      │                (provider + validator)   (runtime registry)        (IndexedDB)  │
│      │                          │                      │                              │
│      │                          ▼                      ▼                              │
│      │                  LlmProvider ──HTTPS──►  LanguageRuntime (lazy)                │
│      │                  (BYOK / proxy)          └─ SandboxRuntime                     │
│      │                  SampleSource (offline)       ├─ Web Worker: TS·Py·PHP·C·C++   │
│      │                                               └─ sandboxed iframe: React       │
└──────┴────────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼  (only when generating; user's own key)
                          api.anthropic.com / optional proxy
```

## 2. Pipeline

```text
Challenge definition (Zod-validated)
      ↓
Language definition (registry)  ── decides runtime, file names, editor mode
      ↓
LanguageRuntime (lazy loaded)    ── SandboxRuntime + Worker / iframe endpoint
      ↓
Test harness (per language)      ── assembles solution + tests, emits result protocol
      ↓
ExecutionResult / TestRunResult  ── normalized, output-limited
      ↓
Evaluation                       ── lifecycle transition (in-progress → passed)
      ↓
Persistence                      ── ChallengeRepository (IndexedDB)
```

## 3. Domain model

Defined as Zod schemas in `src/domain/` — types are inferred from schemas so there is exactly one source of truth.

| Concept                          | Purpose                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `LanguageId`                     | `typescript · react · python · php · c · cpp · java`                                               |
| `Difficulty`                     | `beginner · intermediate · advanced · expert` (ordered)                                            |
| `Category`, `Archetype`          | Extensible taxonomies used for generation variety and filtering                                    |
| `Challenge`                      | Immutable definition: statement, requirements, starter code, tests, reference solution, provenance |
| `TestSuite`                      | `{ prelude, cases[] }` — test code in the challenge's own language                                 |
| `TestCase`                       | `{ id, name, description?, hidden, code }`                                                         |
| `Attempt`                        | Mutable user state for one challenge: solution, lifecycle status, last results, notes              |
| `PortfolioBundle` / `ExportFile` | Versioned, portable serialisation                                                                  |

### Tests are code, not data

The spec suggests `input`/`expectedOutput` pairs. That model does not survive contact with real challenges: "deduplicates concurrent requests", "the list ignores stale responses", "the ring buffer rejects writes when full" are behaviours, not I/O pairs. Tests are therefore **snippets of code in the challenge's language**, written against a tiny per-language assertion harness. The harness reports results through a common protocol, so the rest of the app sees one uniform `TestResult` shape. See [ADR-011](adr/011-test-model.md).

### Lifecycle

```text
generated ──edit──► in-progress ──all tests pass──► passed
                        ▲                              │
                        └──────edit after pass─────────┘  (passed is sticky: completedAt kept,
                                                          but the "current solution" may diverge;
                                                          the passing solution is stored separately)
```

`Save` persists at any stage. Only a full test run (visible **and** hidden cases) with every case passing marks an attempt `passed`, and the exact passing source is snapshotted as `passedSolution`.

## 4. Runtime contract

```ts
interface LanguageRuntime {
  readonly language: LanguageId;
  readonly kind: "browser"; // future: "remote"
  isSupported(): RuntimeSupport; // feature detection (WebAssembly, Wasm-GC…)
  initialize(onProgress?: (p: InitProgress) => void): Promise<void>;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  runTests(request: TestRunRequest): Promise<TestRunResult>;
  dispose(): void;
}
```

- **SandboxRuntime** (the generic host) owns one isolated endpoint, a request/response protocol over a private `MessagePort`, a wall-clock timeout, cancellation, output caps and recovery. On timeout or crash the endpoint is destroyed and lazily recreated. Endpoint factories adapt it to a Web Worker or a sandboxed iframe (React).
- Language modules provide a host-agnostic **handler** (`init`, `execute`, `runTests`) plus a test harness. The same handler code runs in the browser and in Node tests against the real toolchains. See [runtimes.md](runtimes.md).
- The UI talks to `ExecutionService`, which resolves a runtime from the registry via dynamic `import()` — no runtime code is in the main bundle.

## 5. Challenge generation

```text
GenerationRequest (language?, difficulty?, category?, archetype?)
   ↓ resolve randomness (seeded picker, weighted away from recent history)
PromptBuilder (versioned prompt files in /prompts)
   ↓
ChallengeSource — LlmChallengeSource(AnthropicProvider | ProxyProvider) | SampleChallengeSource
   ↓
parse JSON → Zod schema → semantic checks → duplicate check
   ↓
runtime validation: reference passes all tests; starter compiles and does NOT pass all tests
   ↓ (on failure: retry with validator feedback, bounded attempts)
Challenge accepted → Attempt(status: generated) persisted
```

## 6. Persistence

`ChallengeRepository` interface with an IndexedDB implementation (`idb`) and an in-memory implementation for tests. Stores: `attempts` (keyed by challenge id, indexed by status/language/updatedAt). Preferences live in `localStorage` behind a `SettingsStore`. The API key is stored separately and never exported. Schema versions are migrated on open.

## 7. Portfolio publishing

A visitor to the GitHub Pages site has an empty IndexedDB. Completed work is therefore **published**: the owner exports a portfolio bundle (`portfolio.json`) and commits it to `public/portfolio/`. The library view merges _published_ challenges (read-only, fetched from the site) with _local_ ones. This is the static-file export path the spec asks to design for, implemented as a single validated JSON file.

## 8. Module layout

```text
src/
  app/            router, layout, providers
  components/     design-system primitives (Button, Dialog, Badge, Tabs, …)
  domain/         schemas + pure domain logic (lifecycle, filtering, stats, fingerprint)
  features/
    workspace/    challenge page: statement, editor, output, tests
    library/      My Challenges + portfolio read-only view
    dashboard/    landing page
    generation/   generate dialog/hooks
    settings/
    import-export/
  editor/         CodeMirror wrapper + language modes
  runtimes/       host abstractions + one folder per language (worker entries)
  services/
    generation/   prompt builder, providers, validator, dedupe
    execution/    ExecutionService, result normalisation
  persistence/    repository + settings store + migrations
  sandbox/        React iframe entry (separate Vite input)
prompts/          versioned LLM prompts (imported as raw text)
fixtures/         deterministic challenges for tests/dev (not a production pool)
tests/            integration, regression, e2e
```
