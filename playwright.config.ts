import { defineConfig } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";
const trustedToken = process.env.VERCEL_OIDC_TOKEN;
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  use: {
    baseURL,
    extraHTTPHeaders: trustedToken
      ? { "x-vercel-trusted-oidc-idp-token": trustedToken }
      : undefined,
    viewport: { width: 390, height: 844 },
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "node scripts/serve-preview.mjs",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
  reporter: "list",
});
