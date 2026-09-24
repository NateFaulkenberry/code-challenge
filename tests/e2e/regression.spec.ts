import { expect, test } from "@playwright/test";
import { generateSample } from "./helpers";

test("regression: the workspace fits the viewport without page scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("./");
  await generateSample(page, { language: "react" });
  await expect(page.getByText("React ready")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("regression: deep links work under the GitHub Pages base path", async ({ page }) => {
  await page.goto("./#/challenges");
  await expect(page.getByRole("heading", { name: "My Challenges" })).toBeVisible();
  await page.goto("./#/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("responsive: the workspace stacks on small screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await generateSample(page, { language: "typescript", difficulty: "beginner" });
  const editor = page.getByRole("textbox", { name: /solution editor/i });
  await expect(editor).toBeVisible();
  // Long code lines scroll inside the editor; the page itself must not overflow.
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(390);
});
