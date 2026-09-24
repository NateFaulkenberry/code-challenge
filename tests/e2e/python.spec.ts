import { expect, test } from "@playwright/test";
import { generateSample, replaceEditorContents, solveCurrentChallenge } from "./helpers";

test("python: Pyodide worker runs code and tests in the browser", async ({ page }) => {
  await page.goto("./");
  await generateSample(page, { language: "python" });
  await expect(page.getByText("Python ready")).toBeVisible({ timeout: 45_000 });

  await replaceEditorContents(
    page,
    `import sys\nprint("hello from CPython", sys.version_info[:2])`,
  );
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByLabel("Standard output")).toContainText("hello from CPython (3, 14)");

  await solveCurrentChallenge(page);
  await expect(page.getByText("Submission · 8/8 passed")).toBeVisible();
});

test("python: an infinite loop times out and the runtime recovers", async ({ page }) => {
  await page.goto("./#/settings");
  await page.getByLabel("Time limit (seconds)").fill("3");
  await page.goto("./");
  await generateSample(page, { language: "python" });
  await expect(page.getByText("Python ready")).toBeVisible({ timeout: 45_000 });

  await replaceEditorContents(page, `while True:\n    pass`);
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByText("Execution timed out")).toBeVisible();

  // The worker was terminated; the next run starts a fresh interpreter.
  await replaceEditorContents(page, `print("recovered")`);
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByLabel("Standard output")).toHaveText("recovered", { timeout: 45_000 });
});
