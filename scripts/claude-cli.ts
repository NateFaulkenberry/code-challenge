/**
 * npm run claude:login | claude:token — runs the official Claude Code binary
 * that ships with the Agent SDK, for Anthropic's own sign-in flows:
 *   login → `claude auth login`   token → `claude setup-token`
 * Output (including any token) goes straight to your terminal; nothing is saved.
 */
import { spawnSync } from "node:child_process";
import { bundledClaudeBinary } from "./claude-common.ts";

const commands: Record<string, string[]> = { login: ["auth", "login"], token: ["setup-token"] };
const args = commands[process.argv[2] ?? ""];
if (!args) {
  console.error("Usage: claude-cli.ts login|token");
  process.exit(2);
}
const binary = bundledClaudeBinary();
if (!binary) {
  console.error(
    "The Claude Code binary bundled with @anthropic-ai/claude-agent-sdk was not found. Run `npm install`.",
  );
  process.exit(1);
}
const env = { ...process.env };
// Make sure the sign-in is a subscription login, not an API key.
delete env.ANTHROPIC_API_KEY;
delete env.ANTHROPIC_AUTH_TOKEN;
const result = spawnSync(binary, args, { stdio: "inherit", env });
process.exit(result.status ?? 1);
