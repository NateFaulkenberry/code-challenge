# ADR-018: Local-Only Claude via the Agent SDK and a Claude Subscription

## Status

Accepted — 2026-09-24

## Context

The owner wants to generate challenges locally with their existing Claude Max subscription rather than an API key. The public site is static (GitHub Pages) and must never hold or use credentials. Anthropic's documentation, researched on 2026-09-24:

- **The Agent SDK authenticates through Claude Code.** The authentication docs list "the Agent SDK" among the supported login paths for claude.ai accounts, and document `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) as a subscription token for scripts and CI.
- **Subscription usage is acknowledged.** The support article _Use the Claude Agent SDK with your Claude plan_ states that Agent SDK usage "still draw[s] from your subscription's usage limits."
- **Products can't offer subscription login.** The SDK docs say third-party developers may not _offer claude.ai login or rate limits for their products_ without approval, and recommend API keys for applications.
- **API keys win precedence.** `ANTHROPIC_API_KEY` and similar credentials silently outrank the subscription login.

## Decision

- **Where it runs.** The Vite dev server hosts `/__local/claude/*` through a `serve`-only plugin (`server/claude`). The browser gets a `claude-local` provider gated on `import.meta.env.DEV`. There is no separate backend process.
- **One SDK boundary.** `server/claude/agent-sdk.ts` is the only place the real SDK is loaded. Two providers sit behind a `ClaudeProvider` interface: `SubscriptionClaudeProvider` and `DisabledClaudeProvider`, which is the default.
- **Subscription only.**
  - API-billing variables are stripped, and settings files aren't loaded.
  - The account is verified before any prompt is sent, and the session init message is checked again.
  - There is no API-key provider and no fallback.
- **Claude Code sandboxing.** Claude Code runs with no tools, one turn, no MCP servers and no session persistence, in an empty temporary directory.
- **Endpoint protection.** The endpoints accept only same-origin requests to a loopback `Host`, never send CORS headers, and redact secrets.
- **Docker.** The token is injected at runtime (`CLAUDE_CODE_OAUTH_TOKEN` interpolated by Compose). The port is published on loopback only.
- **Build guard.** `check:bundle` scans every production build in CI and before deploy.

## Alternatives Considered

- **A standalone local API server.** It's another process to run, and the dev server is already the local Node process, including in Docker.
- **Calling `claude -p` directly.** That's the same authentication, but a weaker contract: no typed messages, no account check before sending.
- **Mounting `~/.claude` into Docker.** On macOS the login lives in the Keychain, which a Linux container can't read. It would also expose the whole Claude Code config directory.
- **An API-key fallback.** Rejected explicitly: silent API billing is what this integration must prevent.

## Consequences

- **Owner-only.** It works for the repository owner on their own machine. It must never be deployed or shared, and the architecture and CI enforce that.
- **Plan limits apply.** Generation draws from the owner's plan limits, and a reached limit surfaces as an error.
- **Policy may change.** Anthropic changed Agent SDK billing policy twice in 2026. If subscription use for SDK applications becomes disallowed, deleting `server/claude` and one plugin line removes the feature cleanly.
- **Dev dependency.** `@anthropic-ai/claude-agent-sdk` (~220 MB with its platform binary) is a devDependency and is never shipped.
