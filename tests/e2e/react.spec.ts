import { expect, test } from "@playwright/test";
import { generateSample, solveCurrentChallenge } from "./helpers";

test("react: interactive sandboxed preview and Testing Library tests", async ({ page }) => {
  await page.goto("./");
  await generateSample(page, { language: "react" });
  await expect(page.getByText("React ready")).toBeVisible();

  // Regression (react-preview-hidden-focus): tests run while the preview tab is inactive.
  await solveCurrentChallenge(page);
  await expect(page.getByText("Submission · 9/9 passed")).toBeVisible();

  await page.getByRole("button", { name: /^Run/ }).click();
  const preview = page.frameLocator("iframe.ccl-sandbox-frame");
  await preview.getByRole("searchbox", { name: "Search users" }).fill("gr");
  await expect(preview.getByText("Grace Hopper")).toBeVisible();
});

test("react: the sandbox cannot reach the parent page or its storage", async ({ page }) => {
  await page.goto("./");
  await generateSample(page, { language: "react" });
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.frameLocator("iframe.ccl-sandbox-frame").getByRole("searchbox")).toBeVisible();
  const frame = page.frames().find((f) => f.url().includes("sandbox.html"));
  expect(frame).toBeDefined();
  const probe = await frame!.evaluate(() => {
    const attempt = (fn: () => unknown) => {
      try {
        return String(fn());
      } catch (error) {
        return (error as Error).name;
      }
    };
    return {
      parentDocument: attempt(() => typeof window.parent.document),
      localStorage: attempt(() => typeof localStorage.getItem),
      fetch: typeof fetch,
      indexedDB: typeof indexedDB,
      origin: self.origin,
    };
  });
  expect(probe).toEqual({
    parentDocument: "SecurityError",
    localStorage: "SecurityError",
    fetch: "undefined",
    indexedDB: "undefined",
    origin: "null",
  });
});
