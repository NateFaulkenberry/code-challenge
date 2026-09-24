/**
 * npm run claude:setup — explains the supported (official) ways to give the
 * local integration access to your Claude subscription, then runs the check.
 * It never reads, stores or prints credentials itself: Claude Code owns them.
 */
import { bundledClaudeBinary, printHeader, subscriptionProvider } from "./claude-common.ts";

printHeader("Local Claude setup");
console.log(`This integration runs Claude through the official Claude Agent SDK, which uses Claude Code's
own authentication. Anthropic documents two ways to authenticate with a Claude subscription:

  1. Sign in with Claude Code (recommended for running locally)
       npm run claude:login        # opens the browser sign-in; choose your Claude (Pro/Max) account
     macOS stores the login in the Keychain; Linux in ~/.claude/.credentials.json.
     If you already use Claude Code (CLI or IDE extension) and are signed in, nothing else is needed.

  2. A long-lived subscription token (for Docker and headless use)
       npm run claude:token        # runs \`claude setup-token\`; prints a token once
     Put it in the untracked .env file as CLAUDE_CODE_OAUTH_TOKEN=... (never commit it).
     docker compose passes it to the container at runtime only.

Do NOT set ANTHROPIC_API_KEY for this: the integration ignores API keys by design.
`);
console.log(
  `Bundled Claude Code binary: ${bundledClaudeBinary() ?? "not found — run `npm install` (optional dependencies must be installed)"}`,
);

const status = await subscriptionProvider().status();
console.log(
  `\nCurrent status: ${status.state}${status.subscription ? ` (${status.subscription})` : ""}\n${status.message}`,
);
if (status.state !== "ready") process.exitCode = 1;
