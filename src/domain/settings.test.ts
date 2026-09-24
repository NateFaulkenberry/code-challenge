import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("falls back to defaults for garbage", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and drops invalid ones individually", () => {
    const parsed = parseSettings({
      editorFontSize: 18,
      tabSize: 3,
      theme: "dark",
      executionTimeoutMs: 5,
    });
    expect(parsed).toMatchObject({
      editorFontSize: 18,
      tabSize: DEFAULT_SETTINGS.tabSize,
      theme: "dark",
    });
    expect(parsed.executionTimeoutMs).toBe(DEFAULT_SETTINGS.executionTimeoutMs);
  });

  it("ignores unknown keys such as a smuggled api key", () => {
    expect(parseSettings({ apiKey: "sk-secret" })).not.toHaveProperty("apiKey");
  });
});
