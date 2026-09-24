import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { generateSample, solveCurrentChallenge } from "./helpers";

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // CodeMirror's contenteditable is covered by the editor's own accessibility support.
    .exclude(".cm-content")
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary, `${label} accessibility violations`).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`accessibility (${colorScheme}): main views have no WCAG A/AA violations`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("./");
    await expectNoViolations(page, "dashboard");

    await generateSample(page, { language: "typescript", difficulty: "beginner" });
    await expect(page.getByText("TypeScript ready")).toBeVisible();
    await expectNoViolations(page, "workspace");

    await solveCurrentChallenge(page);
    await expectNoViolations(page, "workspace (passed)");

    await page.getByRole("link", { name: /View in portfolio/ }).click();
    await expect(page.getByRole("heading", { name: "My solution" })).toBeVisible();
    await expectNoViolations(page, "portfolio view");

    await page.goto("./#/challenges");
    await expectNoViolations(page, "library");

    await page.goto("./#/settings");
    await expectNoViolations(page, "settings");

    await page.goto("./");
    await page.getByRole("button", { name: "New challenge" }).click();
    await expectNoViolations(page, "generate dialog");
  });
}

test("keyboard: skip link and dialog focus management", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.getByRole("button", { name: "New challenge" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "New challenge" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "New challenge" })).toBeFocused();
});
