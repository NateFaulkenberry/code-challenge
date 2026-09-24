/**
 * npm run claude:check — reports whether the local Claude integration can use
 * your Claude subscription. It asks Claude Code for account details only; no
 * prompt is sent, so it consumes no usage. Never prints secrets or your email.
 */
import { describeEnvironment, printHeader, subscriptionProvider } from "./claude-common.ts";

printHeader("Claude local integration");
const status = await subscriptionProvider().status();
console.log("Provider:           Claude Agent SDK (@anthropic-ai/claude-agent-sdk)");
console.log("Authentication:     Claude subscription (no API key)");
console.log(
  `Status:             ${status.state === "ready" ? `authenticated — ${status.subscription ?? "subscription"}` : status.state}`,
);
describeEnvironment();
console.log(`\n${status.message}`);
if (status.state !== "ready") {
  console.log("\nNext step: `npm run claude:setup` explains the supported ways to sign in.");
  process.exitCode = 1;
} else {
  console.log(
    "\nStart the app with local Claude: `npm run dev:claude` (Docker: see docs/local-claude.md).",
  );
}
