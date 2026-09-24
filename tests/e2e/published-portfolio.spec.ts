import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

// The owner's real committed portfolio, exactly as the deployed site serves it.
const committed = JSON.parse(
  readFileSync(new URL("../../public/portfolio/portfolio.json", import.meta.url), "utf8"),
) as {
  attempts: { challenge: { title: string } }[];
};

test.describe("published portfolio (what visitors see)", () => {
  test.use({ publishedPortfolio: committed });

  test("committed entries appear read-only with no local data", async ({ page }) => {
    test.skip(committed.attempts.length === 0, "Nothing published yet.");
    const [first] = committed.attempts;
    await page.goto("./#/challenges");
    await expect(page.getByRole("link", { name: first!.challenge.title })).toBeVisible();
    await expect(page.getByText("published").first()).toBeVisible();
    await page.getByRole("link", { name: first!.challenge.title }).click();
    await expect(page.getByRole("heading", { name: "My solution" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open in workspace/ })).toHaveCount(0);
  });
});
