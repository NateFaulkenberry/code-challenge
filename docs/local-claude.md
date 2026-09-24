# Local Claude (Agent SDK + Claude subscription)

An optional, **local-only** way to generate challenges using your own Claude subscription (Pro or Max) instead of an API key. It runs Claude through Anthropic's official Claude Agent SDK on your local dev server. It doesn't exist on the public GitHub Pages site.

```text
LOCAL DEVELOPMENT                                  PUBLIC GITHUB PAGES
Browser (Settings → "Claude — Local Only")         Static files only
   │  same-origin fetch, no credentials             Local Claude: absent
   ▼                                                (no code, no endpoint,
Vite dev server  /__local/claude/*                   no configuration)
   │  server/claude (Node only)
   ▼
Claude Agent SDK → bundled Claude Code binary
   │  Claude Code's own subscription login
   ▼
Your Claude plan
```

## 1. What it does

Adds a challenge-generation provider, **Claude — Local Only**, that sends generation prompts to your local dev server. The server runs them through `@anthropic-ai/claude-agent-sdk`, signed in with your Claude subscription. The rest of the pipeline is unchanged: schema checks, running the reference solution against its tests, repair loops.

## 2. Why it exists

So the project's owner can generate challenges locally using the Claude plan they already have, without creating or managing an API key.

## 3. Why it's local-only

A subscription login is a personal credential. Anthropic's documentation says:

> Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK.

This integration offers nobody a login. It runs on your machine, with your account, for your own use. Exposing it through a public site would amount to offering your subscription to others, which is exactly what that policy forbids and why the public build contains none of it. The Agent SDK docs recommend API keys for applications; for API-key billing, use the app's separate **Anthropic — your own API key** provider.

## 4. Which authentication it uses

**Claude Code's own subscription authentication**, which is how the Agent SDK authenticates. There are two documented forms:

- **Your Claude Code login (`/login`, `claude auth login`)**: stored in the macOS Keychain, or `~/.claude/.credentials.json` on Linux. If you already use Claude Code (CLI or IDE extension) signed in to your Pro/Max account, it just works.
- **`CLAUDE_CODE_OAUTH_TOKEN`**: a one-year subscription token from `claude setup-token`, documented for scripts, CI and headless environments. This is what Docker uses.

The app never reads, stores, copies or transmits these credentials. Only the Claude Code process spawned by the SDK touches them.

**API keys are never used.** In Claude Code's precedence order, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `apiKeyHelper` and cloud-provider variables all outrank the subscription login. If any of them leaked in, usage would silently move to API billing. The integration prevents that in three ways:

1. **Stripped variables:** all API-billing variables are removed from Claude Code's environment (`server/claude/safe-env.ts`).
2. **Isolated settings:** settings files aren't loaded (`settingSources: []`), so no `apiKeyHelper` or `env` blocks apply.
3. **Verified before sending:** before any prompt is sent, the account is checked (`accountInfo()`: first-party provider, subscription present, no API key source). The session's own init message is then checked again (`apiKeySource` must be `none`). If either check fails, the request is refused, not rerouted.

## 5. How to authenticate

```bash
npm install
npm run claude:check     # status only: sends no prompt, uses no quota, prints no secrets
npm run claude:setup     # explains the options, then re-checks
npm run claude:login     # runs Claude Code's browser sign-in (choose your Claude account)
npm run claude:token     # runs `claude setup-token` (for Docker), prints a token once
```

`claude:login` and `claude:token` run the official Claude Code binary bundled with the Agent SDK. No separate install is needed. Example check output:

```text
Claude local integration
------------------------
Provider:           Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
Authentication:     Claude subscription (no API key)
Status:             authenticated — Claude Max
```

## 6. Run the app locally with Claude

```bash
npm run dev:claude       # = CLAUDE_PROVIDER=subscription npm run dev
```

Open http://localhost:5173 and go to **Settings → Challenge generation → Provider → Claude — Local Only**. The panel shows the status, and the header shows **Claude — Local Only · Claude Max** when ready.

| Variable            | Values                                               | Default               |
| ------------------- | ---------------------------------------------------- | --------------------- |
| `CLAUDE_PROVIDER`   | `subscription`, `disabled`                           | `disabled`            |
| `CLAUDE_MODEL`      | a Claude Code model id or alias                      | Claude Code's default |
| `CLAUDE_TIMEOUT_MS` | 5000–600000                                          | 480000 (8 min)        |
| `CLAUDE_DEBUG`      | `1` to log message types and timings (never content) | off                   |

Any other `CLAUDE_PROVIDER` value (including `api`) leaves the integration disabled, and the reason shows in the status.

## 7. Run it in Docker

The container is Linux, so it can't read your macOS Keychain. Use the documented long-lived subscription token, injected **at runtime**:

```bash
npm run claude:token                       # on the host; copy the printed token
cp .env.example .env                       # .env is gitignored and excluded from the Docker build
# edit .env:  CLAUDE_PROVIDER=subscription
#             CLAUDE_CODE_OAUTH_TOKEN=<token>
docker compose up
```

- **No credentials in the image:** nothing is baked in. The Dockerfile has no credential `ENV`, and `.env` / `.env.*` are in `.dockerignore`.
- **Runtime only:** `docker-compose.yml` interpolates `CLAUDE_CODE_OAUTH_TOKEN` from your shell or `.env` when the container starts.
- **Loopback only:** the dev server is published on `127.0.0.1` only, so neither it nor the Claude endpoint is reachable from your network.
- **Revocation:** revoke the token from your Claude account settings if it leaks. Anthropic's devcontainer guidance notes that anything inside a container can read credentials available to it.

If you'd rather not create a token, run `npm run dev:claude` on the host instead; that uses your normal Claude Code login.

## 8. Testing

- **`npm test`** never contacts Claude. The SDK sits behind one boundary (`server/claude/agent-sdk.ts`), which tests replace with a fake that records what _would_ have been sent. The tests cover:
  - provider selection, configuration and malformed values;
  - authenticated, unauthenticated and API-key-present environments, including proof that no prompt is sent when authentication is wrong;
  - SDK load failures, request failures, rate limits, timeouts and cancellation;
  - redaction of secrets from errors and logs;
  - the HTTP handler: CSRF, DNS rebinding, the opaque-origin sandbox, no CORS, no secrets in responses;
  - that production can't create the provider.
- **`npm run check:bundle`** (also run in CI and before every deploy) scans the production build for credential shapes, serialized OAuth state, Claude credential-store references, the local endpoint, and Agent SDK code.
- **`npm run claude:test`** is the **optional, manual** live test. It sends one tiny real request ("reply with exactly `CLAUDE_LOCAL_OK`"), which uses a small amount of your plan's usage. It is never part of `npm test` or CI.

### Troubleshooting

- **Generation is slow or times out.** One full challenge attempt with extended thinking takes about 2–3 minutes: roughly 110 s thinking plus 50 s writing the JSON. Validation can trigger a repair attempt, which adds another request. The default per-request timeout is 8 minutes. Raise `CLAUDE_TIMEOUT_MS` (up to 600000) if needed, or set `CLAUDE_MODEL` to a faster model.
- **See what Claude is doing.** Start with `CLAUDE_DEBUG=1` (for example `CLAUDE_DEBUG=1 docker compose up`). The dev server then logs each message type with its elapsed time, such as `+90316ms system/thinking_tokens` or `+156743ms result/success`. Prompts and responses are never logged.

## 9. Disabling it

It's disabled by default: plain `npm run dev` and `docker compose up` don't enable it. To turn it off again, run without `CLAUDE_PROVIDER=subscription` and pick another provider in Settings. To remove it entirely, delete `server/claude`, the `localClaudePlugin()` line in `vite.config.ts`, and the `claude:*` scripts.

## 10. Why it must not be exposed through GitHub Pages

Anything served publicly can be used by anyone. A public endpoint would let visitors spend your subscription and act as your account. That breaks Anthropic's terms (account sharing, and offering claude.ai login in a product) and exposes a personal credential. The build is structured so this can't happen:

- **Dev server only:** the plugin is `apply: "serve"`, so `vite build` never runs it.
- **Stripped from the bundle:** browser code is gated on `import.meta.env.DEV` and removed from production bundles.
- **Guarded by CI:** `check:bundle` fails the build if any trace of the endpoint or SDK appears.

## 11. When Claude is unavailable

- **Public site:** the option simply doesn't exist. Visitors see the normal providers and offline samples, never an error.
- **Local but not ready** (disabled, not signed in, API key detected, or server unreachable): the Settings panel and the header show _not ready_ with the specific reason and the next command to run. Generation is refused with that message. It never falls back to an API key.
- **Usage limit reached:** generation reports that your plan's limit was hit. Try again after it resets.

## 12. Usage and billing under Anthropic's current policy

As of Anthropic's support article _Use the Claude Agent SDK with your Claude plan_ (updated June 16, 2026):

> For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits.

In practice:

- **Your plan's limits:** requests count toward your Claude plan's usage limits, shared with Claude on the web and Claude Code.
- **No API billing:** there are no API charges; the integration refuses to run with an API key.
- **No separate SDK credit:** a separate monthly Agent SDK credit was announced for June 15, 2026 and then paused. That article states it "isn't available."

Anthropic has changed this policy during 2026. Check the linked article before relying on it.

## Official sources

- Agent SDK overview (includes the third-party login note): https://code.claude.com/docs/en/agent-sdk/overview
- Agent SDK quickstart: https://code.claude.com/docs/en/agent-sdk/quickstart
- Claude Code authentication (precedence, `setup-token`, credential storage; lists the Agent SDK as a login path): https://code.claude.com/docs/en/authentication
- Use the Claude Agent SDK with your Claude plan: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- Development containers: https://code.claude.com/docs/en/devcontainer
- Consumer Terms of Service: https://www.anthropic.com/legal/consumer-terms
- TypeScript SDK: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk (version 0.3.281 used here)
