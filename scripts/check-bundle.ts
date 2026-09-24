/**
 * Scans a production build for credentials and for anything belonging to the
 * local-only Claude integration. Run in CI before every deployment:
 *
 *   node --experimental-strip-types scripts/check-bundle.ts [dist]
 *
 * Patterns target credential *shapes* and assignments rather than bare words
 * (e.g. "oauth"), so documentation strings and third-party toolchains don't
 * cause false positives.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

export interface BundleRule {
  id: string;
  description: string;
  pattern: RegExp;
}

export const BUNDLE_RULES: readonly BundleRule[] = [
  {
    id: "anthropic-credential",
    description: "Anthropic API key or OAuth token",
    pattern: /sk-ant-[a-z]{2,8}\d{0,3}-[A-Za-z0-9_-]{20,}/,
  },
  {
    id: "credential-assignment",
    description: "credential environment variable with a value",
    pattern:
      /\b(?:ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN)\s*[=:]\s*["'`]?[A-Za-z0-9_.-]{16,}/,
  },
  {
    id: "serialized-oauth-token",
    description: "serialized OAuth access/refresh token",
    pattern:
      /["'](?:access_token|refresh_token|accessToken|refreshToken)["']\s*:\s*["'][A-Za-z0-9._~+/=-]{16,}["']/,
  },
  {
    id: "claude-credentials-store",
    description: "Claude Code credential store reference",
    pattern: /claudeAiOauth|\.credentials\.json/,
  },
  {
    id: "local-claude-endpoint",
    description: "local-only Claude endpoint",
    pattern: /__local\/claude/,
  },
  {
    id: "agent-sdk-code",
    description: "Claude Agent SDK code",
    pattern: /claude-agent-sdk|CLAUDE_AGENT_SDK_CLIENT_APP/,
  },
  {
    id: "developer-home-path",
    description: "local home-directory path",
    pattern: /\/Users\/[A-Za-z0-9._-]+\/(?:\.claude|Documents|Library)/,
  },
];

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".html",
  ".css",
  ".json",
  ".map",
  ".txt",
  ".svg",
  ".webmanifest",
  ".xml",
]);

export interface Finding {
  file: string;
  rule: string;
  description: string;
  excerpt: string;
}

/** Excerpts are masked so a finding never re-publishes the secret in CI logs. */
function mask(text: string): string {
  return text.length <= 12 ? "***" : `${text.slice(0, 8)}…(${text.length} chars)`;
}

export function scanText(
  file: string,
  text: string,
  rules: readonly BundleRule[] = BUNDLE_RULES,
): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    const match = rule.pattern.exec(text);
    if (match)
      findings.push({
        file,
        rule: rule.id,
        description: rule.description,
        excerpt: mask(match[0]),
      });
  }
  return findings;
}

export function scanDirectory(root: string): { findings: Finding[]; filesScanned: number } {
  const findings: Finding[] = [];
  let filesScanned = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (TEXT_EXTENSIONS.has(extname(entry).toLowerCase())) {
        filesScanned++;
        findings.push(...scanText(relative(root, path), readFileSync(path, "utf8")));
      }
    }
  };
  walk(root);
  return { findings, filesScanned };
}

if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  const root = process.argv[2] ?? "dist";
  const { findings, filesScanned } = scanDirectory(root);
  if (findings.length) {
    console.error(`✗ ${findings.length} problem(s) in ${root}:`);
    for (const f of findings)
      console.error(`  ${f.file}: ${f.description} [${f.rule}] ${f.excerpt}`);
    process.exit(1);
  }
  console.log(
    `✓ ${filesScanned} text files in ${root} contain no credentials or local-only Claude code.`,
  );
}
