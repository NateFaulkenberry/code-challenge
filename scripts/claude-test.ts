/**
 * npm run claude:test — OPTIONAL live integration test. Makes ONE real, tiny
 * Claude request through the local integration, using your Claude
 * subscription. It is never part of `npm test` and consumes a small amount of
 * your plan's usage.
 */
import { printHeader, subscriptionProvider } from "./claude-common.ts";

const EXPECTED = "CLAUDE_LOCAL_OK";

printHeader("Local Claude integration test");
console.log(
  "⚠  This sends one small real request to Claude and counts toward your Claude plan's usage limits.\n",
);

const provider = subscriptionProvider((line) => console.log(`   [claude] ${line}`));
const status = await provider.status();
if (status.state !== "ready") {
  console.error(
    `✗ Not ready (${status.state}): ${status.message}\n  Run \`npm run claude:setup\`.`,
  );
  process.exit(1);
}
console.log(
  `Authenticated with ${status.subscription ?? "your Claude subscription"}. Sending test request…`,
);

try {
  const response = await provider.run({
    system: "You are a connectivity check. Follow the instruction exactly and output nothing else.",
    messages: [{ role: "user", content: `Reply with exactly ${EXPECTED}` }],
  });
  const ok = response.text.trim() === EXPECTED;
  console.log(
    `${ok ? "✓" : "✗"} Response: ${JSON.stringify(response.text.trim().slice(0, 200))} · model ${response.model} · ${response.durationMs} ms`,
  );
  process.exit(ok ? 0 : 1);
} catch (error) {
  const code = (error as { code?: string }).code ?? "error";
  console.error(
    `✗ Request failed (${code}): ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
