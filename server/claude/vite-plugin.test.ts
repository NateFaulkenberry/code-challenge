import { describe, expect, it } from "vitest";
import { localClaudePlugin } from "./vite-plugin.ts";

describe("localClaudePlugin", () => {
  it("only applies to the dev server, never to production builds", () => {
    const plugin = localClaudePlugin({ CLAUDE_PROVIDER: "subscription" });
    expect(plugin.apply).toBe("serve");
    expect(plugin).not.toHaveProperty("generateBundle");
    expect(plugin).not.toHaveProperty("transform");
  });
});
