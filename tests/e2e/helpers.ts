import { expect, type Page } from "@playwright/test";

export async function generateSample(
  page: Page,
  options: { language: string; difficulty?: string },
): Promise<void> {
  await page.getByRole("button", { name: "New challenge" }).click();
  const dialog = page.getByRole("dialog", { name: "New challenge" });
  await dialog.getByLabel("Language", { exact: true }).selectOption(options.language);
  if (options.difficulty)
    await dialog.getByLabel("Difficulty", { exact: true }).selectOption(options.difficulty);
  await dialog.getByRole("button", { name: "Generate challenge" }).click();
  await page.waitForURL(/#\/workspace\//);
}

/** Replaces the editor contents the way a user would (select all + type/paste). */
export async function replaceEditorContents(page: Page, text: string): Promise<void> {
  const editor = page.getByRole("textbox", { name: /solution editor/i });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(text);
}

/** Reads the stored reference solution — the test plays a user who "knows the answer". */
export async function storedReference(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("coding-challenge-lab");
      request.onsuccess = () => resolve(request.result);
    });
    const id = decodeURIComponent(location.hash.split("/").pop() ?? "");
    const attempt = await new Promise<{ challenge: { referenceSolution: string } }>((resolve) => {
      const request = db.transaction("attempts").objectStore("attempts").get(id);
      request.onsuccess = () =>
        resolve(request.result as { challenge: { referenceSolution: string } });
    });
    return attempt.challenge.referenceSolution;
  });
}

export async function solveCurrentChallenge(page: Page): Promise<void> {
  await replaceEditorContents(page, await storedReference(page));
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("All tests passed — challenge complete")).toBeVisible();
}
