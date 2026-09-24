import { expect, test } from "@playwright/test";
import { generateSample, replaceEditorContents, solveCurrentChallenge } from "./helpers";

// First use downloads ~100 MB of LLVM; allow for it.
test.setTimeout(240_000);

test("c++: clang compiles to WebAssembly and runs tests in the browser", async ({ page }) => {
  await page.goto("./");
  await generateSample(page, { language: "cpp" });
  await expect(page.getByText("C++ ready")).toBeVisible({ timeout: 180_000 });

  await replaceEditorContents(
    page,
    `#include <iostream>\n#include <format>\nint main() { std::cout << std::format("C++{}", __cplusplus / 100 % 100) << std::endl; }`,
  );
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByLabel("Standard output")).toHaveText("C++20", { timeout: 60_000 });

  await solveCurrentChallenge(page);
  await expect(page.getByText("Submission · 8/8 passed")).toBeVisible();
});

test("c: compile errors are shown and marked in the editor", async ({ page }) => {
  await page.goto("./");
  await generateSample(page, { language: "c" });
  await expect(page.getByText("C ready")).toBeVisible({ timeout: 180_000 });
  await replaceEditorContents(page, `int main(void) {\n  return missing;\n}`);
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.getByText("Your code didn't compile")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/use of undeclared identifier 'missing'.*line 2/)).toBeVisible();
});
