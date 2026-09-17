import { defineConfig } from "vite";

// GitHub Pages serves project sites (not a username.github.io repo) at
// https://<user>.github.io/<repo>/, so every asset URL needs that repo-name
// prefix baked in at build time there - without it, the built index.html
// requests assets from the site root and gets 404s. Every other host this
// project deploys to (Vercel, Netlify) serves from its own domain root,
// where that same prefix would be what causes the 404s instead - so root
// ("/") is the default, and the GitHub Pages prefix only kicks in when
// building inside GitHub Actions (which sets `GITHUB_ACTIONS=true` on
// every run - see .github/workflows/deploy.yml), rather than trying to
// name every other host that should get the root-relative default.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/cc-roulette/" : "/",
});
