import { defineConfig } from "vite";

// GitHub Pages serves project sites (not a username.github.io repo) at
// https://<user>.github.io/<repo>/, so every asset URL needs that repo-name
// prefix baked in at build time - without this, the built index.html
// requests assets from the site root and gets 404s.
export default defineConfig({
  base: "/cc-roulette/",
});
