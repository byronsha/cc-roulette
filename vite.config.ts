import { defineConfig, type Plugin } from "vite";

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
const base = process.env.GITHUB_ACTIONS ? "/cc-roulette/" : "/";

// The site's own absolute URL, one per host it deploys to - used only for
// the og:url/og:image meta tags below (see htmlMetaUrls). Vercel's own
// VERCEL_URL env var points at that specific deployment's auto-generated
// hostname, not the human alias (sperminator.vercel.app) actually shared
// around, and Netlify has no build-time signal at all here - so these are
// just the three known live URLs, picked the same way `base` above picks
// its GitHub Pages case.
function siteUrl(): string {
  if (process.env.GITHUB_ACTIONS) return "https://byronsha.github.io/cc-roulette/";
  if (process.env.VERCEL) return "https://sperminator.vercel.app/";
  return "https://sperminator.netlify.app/"; // Netlify, and local dev/preview
}

// A pasted link's rich preview (iMessage, and most other link-preview
// crawlers) gets silently dropped - no thumbnail, just a plain link - when
// the page's own og:url doesn't match the URL that was actually shared;
// treated as a spoofing signal. The three hosts above all built from the
// same index.html, which used to hard-code a single og:url/og:image
// (Netlify's) - fine back when Netlify was the only deployment, but wrong
// on GitHub Pages or Vercel ever since. This substitutes each build's own
// real URL in for the __OG_URL__/__OG_IMAGE__ placeholders in index.html.
function htmlMetaUrls(): Plugin {
  return {
    name: "html-meta-urls",
    transformIndexHtml(html) {
      const url = siteUrl();
      return html.replaceAll("__OG_URL__", url).replaceAll("__OG_IMAGE__", `${url}og-image.png`);
    },
  };
}

export default defineConfig({
  base,
  plugins: [htmlMetaUrls()],
});
