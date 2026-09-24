import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the *production build* served under a non-root base
 * path, mirroring GitHub Pages (https://user.github.io/<repo>/).
 */
const BASE_PATH = "/code-challenge/";
const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: "retain-on-failure",
    // Local runs can use an installed Chrome when Playwright's browser isn't downloaded.
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    command: `BASE_PATH=${BASE_PATH} npm run build && npx vite preview --port ${PORT} --strictPort --base ${BASE_PATH}`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
