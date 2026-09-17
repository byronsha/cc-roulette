import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // tests/visual uses Playwright (real-browser tests), not vitest - run it
    // with `npm run test:visual` instead.
    exclude: [...configDefaults.exclude, "tests/visual/**"],
  },
});
