import { describe, expect, it } from "vitest";
import { assetUrl } from "./asset-url";

describe("assetUrl", () => {
  it("prefixes the base path", () => {
    expect(assetUrl("portfolio/portfolio.json", "/code-challenge/")).toBe(
      "/code-challenge/portfolio/portfolio.json",
    );
    expect(assetUrl("/runtimes/python/", "/code-challenge")).toBe(
      "/code-challenge/runtimes/python/",
    );
    expect(assetUrl("sandbox.html", "/")).toBe("/sandbox.html");
  });
});
