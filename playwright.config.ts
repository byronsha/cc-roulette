import { defineConfig, devices } from "@playwright/test";

// Visual regression / real-browser layout tests. Separate from the vitest
// suite (which uses jsdom - no real layout engine, so it can't catch CSS
// layout bugs like elements overlapping or a flex column overflowing the
// viewport, which is exactly the class of bug this suite exists to catch).
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    // Real Chromium, for a broad baseline.
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    // Real WebKit (same engine family as Safari/iOS) - this is what actually
    // catches mobile-Safari-specific layout bugs; Chromium alone missed the
    // dvh/flex issues that shipped here.
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
    { name: "webkit-mobile-short", use: { browserName: "webkit", viewport: { width: 375, height: 667 } } },
  ],
});
