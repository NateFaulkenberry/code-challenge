import { expect, test } from "@playwright/test";
import { generateSample, replaceEditorContents, solveCurrentChallenge } from "./helpers";

test("php: PHP 8.4 WebAssembly runs code and tests in the browser", async ({ page }) => {
  await page.goto("./");
  await generateSample(page, { language: "php" });
  await expect(page.getByText("PHP ready")).toBeVisible({ timeout: 45_000 });

  await replaceEditorContents(
    page,
    `<?php\necho "PHP ", PHP_MAJOR_VERSION, ".", PHP_MINOR_VERSION, "\\n";`,
  );
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByLabel("Standard output")).toContainText("PHP 8.4");

  await solveCurrentChallenge(page);
  await expect(page.getByText("Submission · 7/7 passed")).toBeVisible();
});
