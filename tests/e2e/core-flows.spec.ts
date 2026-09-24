import { expect, test } from "@playwright/test";
import { generateSample, solveCurrentChallenge } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("generate: choosing TypeScript + Beginner opens that challenge", async ({ page }) => {
  await generateSample(page, { language: "typescript", difficulty: "beginner" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Normalize Article Tags");
  await expect(page.getByText("TypeScript ready")).toBeVisible();
});

test("solve: failing tests, then a passing submission", async ({ page }) => {
  await generateSample(page, { language: "typescript", difficulty: "advanced" });
  await page.getByRole("button", { name: /^Test/ }).click();
  await expect(page.getByText(/Visible tests · \d\/3 passed/)).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Test results" }).getByText("Failed").first(),
  ).toBeAttached();

  await solveCurrentChallenge(page);
  await expect(page.getByText("Submission · 5/5 passed")).toBeVisible();
  await expect(page.getByText("Passed", { exact: true }).first()).toBeVisible();
});

test("run: console output, errors and timeouts are reported", async ({ page }) => {
  await generateSample(page, { language: "typescript", difficulty: "beginner" });
  const editor = page.getByRole("textbox", { name: /solution editor/i });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(`console.log("hello from the worker");`);
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByLabel("Standard output")).toHaveText("hello from the worker");

  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(`while (true) {}`);
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByText("Your code threw an error")).toBeVisible();
  await expect(page.getByLabel("Standard error")).toContainText("infinite loop");
});

test("persistence: a completed challenge survives a reload", async ({ page }) => {
  await generateSample(page, { language: "typescript", difficulty: "beginner" });
  await solveCurrentChallenge(page);
  await page.reload();
  await expect(page.getByText("Passed", { exact: true }).first()).toBeVisible();
  await page.goto("./#/challenges");
  await expect(page.getByRole("link", { name: "Normalize Article Tags" })).toBeVisible();
  await expect(page.getByText("1 completed challenge")).toBeVisible();
});

test("portfolio: read the solution and reveal the reference", async ({ page }) => {
  await generateSample(page, { language: "typescript", difficulty: "beginner" });
  await solveCurrentChallenge(page);
  await page.getByRole("link", { name: /View in portfolio/ }).click();
  await expect(page.getByRole("heading", { name: "My solution" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Solution source code" })).toContainText(
    "normalizeTags",
  );
  await page.getByRole("button", { name: "Reveal solution" }).click();
  const dialog = page.getByRole("dialog", { name: "Reveal the reference solution?" });
  await expect(dialog).toContainText(
    "Viewing the reference solution will reveal the intended implementation.",
  );
  await dialog.getByRole("button", { name: "Reveal solution" }).click();
  await expect(page.getByText("Generated reference implementation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explanation" })).toBeVisible();
});

test("import/export: backup, clear, restore", async ({ page }) => {
  await generateSample(page, { language: "typescript", difficulty: "beginner" });
  await solveCurrentChallenge(page);
  await page.goto("./#/settings");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const path = await download.path();

  await page.getByRole("button", { name: "Clear all challenges" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
  await page.goto("./#/challenges");
  await expect(page.getByText("No challenges yet")).toBeVisible();

  await page.goto("./#/settings");
  await page.getByLabel("Choose an export file to import").setInputFiles(path);
  const dialog = page.getByRole("dialog", { name: "Import challenges" });
  await expect(dialog).toContainText("1 new challenge");
  await dialog.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Import complete")).toBeVisible();
  await page.goto("./#/challenges");
  await expect(page.getByRole("link", { name: "Normalize Article Tags" })).toBeVisible();
});

test("unsaved changes: leaving the workspace asks for confirmation", async ({ page }) => {
  await page.goto("./#/settings");
  await page.getByLabel("Auto-save solutions while typing").uncheck();
  await page.goto("./");
  await generateSample(page, { language: "typescript", difficulty: "beginner" });
  await page.getByRole("textbox", { name: /solution editor/i }).click();
  await page.keyboard.insertText("// edit");
  await page.getByRole("link", { name: "Dashboard" }).click();
  const dialog = page.getByRole("dialog", { name: "You have unsaved changes" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/workspace/);
});
