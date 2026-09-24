/**
 * GitHub project pages serve the app from /<repo>/. Anything built with a
 * hard-coded "/" breaks there (sandbox page, runtime assets, portfolio JSON).
 */
import { describe, expect, it } from "vitest";
import { normalizeBase } from "../../vite.config";
import { assetUrl } from "@/utils/asset-url";

describe("regression: non-root base paths", () => {
  it("normalizes the configured base", () => {
    expect(normalizeBase(undefined)).toBe("/");
    expect(normalizeBase("/")).toBe("/");
    expect(normalizeBase("code-challenge")).toBe("/code-challenge/");
    expect(normalizeBase("/code-challenge")).toBe("/code-challenge/");
    expect(normalizeBase("/code-challenge/")).toBe("/code-challenge/");
  });

  it("builds runtime URLs under the base", () => {
    expect(assetUrl("sandbox.html", "/code-challenge/")).toBe("/code-challenge/sandbox.html");
    expect(assetUrl("portfolio/portfolio.json", "/code-challenge/")).toBe(
      "/code-challenge/portfolio/portfolio.json",
    );
  });
});
