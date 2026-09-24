import { test as base, expect } from "@playwright/test";

/**
 * Every E2E test starts from an empty *published* portfolio, so results don't
 * depend on what the owner has committed to public/portfolio/portfolio.json
 * (published entries appear in the library even after local data is cleared).
 * A test can opt in to a specific portfolio with `publishedPortfolio`.
 */
export const test = base.extend<{ publishedPortfolio: object }>({
  publishedPortfolio: [
    {
      format: "coding-challenge-portfolio",
      version: 1,
      kind: "portfolio",
      exportedAt: "2026-09-24T00:00:00.000Z",
      attempts: [],
    },
    { option: true },
  ],
  page: async ({ page, publishedPortfolio }, provide) => {
    await page.route("**/portfolio/portfolio.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(publishedPortfolio),
      }),
    );
    await provide(page);
  },
});

export { expect };
