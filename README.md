# 🏁 Sperm Race

A pick-who-pays-the-bill decision maker, disguised as a chaotic little racing game. Pick a racer, hit start, and whoever crosses the finish line last pays.

**Play now:**
[byronsha.github.io/cc-roulette](https://byronsha.github.io/cc-roulette/) ·
[sperminator.vercel.app](https://sperminator.vercel.app) ·
[sperminator.netlify.app](https://sperminator.netlify.app)

![Sperm Race screenshot](docs/screenshot.png)

## How it works

- Pick how many racers (2–10) on the setup screen.
- Each racer gets its own color and one of 10 accessories (top hat, baseball cap, crown, bandana, sunglasses, bowtie, cowboy hat, headband, mustache, propeller cap).
- Hit **Start Race** for a "3, 2, 1, GO!" countdown, then watch everyone swim down a winding track - styled like a science-class diagram of a fallopian tube - toward the egg.
- Racer speeds fluctuate randomly with a rubber-band effect (falling behind gives a small speed boost) so the outcome stays uncertain until near the end.
- Cilia dot the middle stretch of the tube - passing through a patch is a chance of getting slowed for a moment (with a little sfx and a visual pulse), never a guarantee. Every hazard has a visible patch of cilia where it actually is; none are invisible.
- A live standings legend in the top-left corner re-ranks racers by current progress as the race unfolds.
- The race ends the instant every racer but one has finished - that last racer is the loser, with a short "ta-da" fanfare going to whoever finished first.

## Stack

- [Vite](https://vitejs.dev/) + vanilla TypeScript, no framework.
- Race simulation and track geometry are pure, DOM-free modules ([`src/raceEngine.ts`](src/raceEngine.ts), [`src/trackGeometry.ts`](src/trackGeometry.ts)) so the core logic is unit-testable without a browser.
- Music/voice cues are pre-recorded clips; the cilia-hit and finish-fanfare sound effects are synthesized at runtime via the Web Audio API (no audio files for those two).
- [Vitest](https://vitest.dev/) for unit tests (race fairness, engine invariants, DOM wiring).
- [Playwright](https://playwright.dev/) for real-browser visual regression tests (mobile viewport layout, screenshot baselines) across Chromium and WebKit.

## Running locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build for production (`dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:visual` | Run visual/layout regression tests (Playwright) |
| `npm run test:visual:update` | Regenerate Playwright screenshot baselines |

## Deployments

The same build ships to three hosts, each serving from its own domain root - `vite.config.ts` picks the right asset path prefix and `og:url`/`og:image` per host at build time (GitHub Pages needs a `/cc-roulette/` prefix; the others serve from `/`).

- **GitHub Pages** - dev/staging. Auto-deploys on every push to `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml); nothing to run by hand.
- **Netlify** and **Vercel** - production mirrors, deployed manually and sparingly (not on every push):
  ```bash
  npm run build
  npx netlify-cli deploy --prod --dir=dist   # Netlify
  npx vercel --prod                          # Vercel
  ```
