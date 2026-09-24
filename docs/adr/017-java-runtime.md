# ADR-017: Java Runtime — Not Supported for Now

## Status

Accepted — 2026-09-24. The owner chose option 4 (keep Java unavailable); revisit if Java becomes a priority.

## Context

Java needs `javac` and a JVM, or an ahead-of-time compiler, running entirely in the browser. The options evaluated ([research.md](../research.md#26-java)):

| Option                                                     | Works in browser                    | Java level                                        | Blocking issue                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TeaVM javac** (javac + TeaVM compiled to Wasm-GC, ~7 MB) | Yes                                 | Java 21 syntax, partial class library, no threads | The `konsoletyper/teavm-javac` repository has **no license file**. Its binaries (from teavm.org) include OpenJDK javac (GPLv2 + Classpath Exception) and are served **without CORS headers**, so they can't be loaded cross-origin; self-hosting means redistributing them. |
| **CheerpJ 4.3**                                            | Yes                                 | Full JVM; in-browser javac only at Java 8 level   | Proprietary. Free use requires loading from the vendor's CDN, with attribution. Console output is DOM-oriented.                                                                                                                                                             |
| DoppioJVM, JWebAssembly, Bytecoder                         | No in-browser compile, or abandoned | —                                                 | —                                                                                                                                                                                                                                                                           |

## Decision

Don't ship a Java runtime. The options, kept for a future revisit:

1. **Self-host the TeaVM javac binaries.** Download them at build time with pinned checksums, include attribution, and link the upstream sources, accepting the unclear redistribution terms.
2. **Build TeaVM javac from source in CI** (Gradle, JDK 21). The licensing position is clear (Apache-2.0 TeaVM + GPLv2-CPE javac, with source available), at the cost of a slower, more complex pipeline.
3. **Use CheerpJ from its CDN.** Java 8 language level and a third-party runtime dependency.
4. **Keep Java unavailable** and document it. **(Chosen.)**

The language registry marks Java as _planned_: the UI labels it unavailable, generation refuses Java requests, and nothing pretends to run Java.

## Consequences

- The architecture needs no change to add Java later: it's a new handler and worker under the existing `LanguageRuntime` contract. Java's constraints and generation rules are already written.
- The spec's "thread-safe task queue" Java example would be out of scope with TeaVM or CheerpJ-level support in any case (no real threads).
