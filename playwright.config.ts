import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  reporter: "html",
  fullyParallel: true,
  testDir: "./__tests__/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    baseURL: "http://localhost:5173",
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      args: ["--start-maximized", "--start-fullscreen"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
  webServer: {
    port: 5173,
    timeout: 120 * 1000,
    command: "pnpm run dev",
    reuseExistingServer: !process.env.CI,
  },
});
