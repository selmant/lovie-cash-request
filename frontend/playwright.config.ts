import { defineConfig, devices } from "@playwright/test";

const slowMo = Number(process.env.PW_SLOW_MO ?? "0");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  outputDir: "./test-results",
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "on",
    launchOptions: {
      slowMo,
    },
    video: {
      mode: "on",
      size: { width: 1500, height: 900 },
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command:
      "VITE_API_PROXY_TARGET=http://127.0.0.1:8080 COREPACK_HOME=../.cache/corepack corepack pnpm exec vite --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
